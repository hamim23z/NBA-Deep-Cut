import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useAnnounce } from '../announcer';
import { suggest, type Suggestion } from '../autocomplete';
import type { Index } from '../matching';
import type { Entry } from '../types';

interface Props {
  index: Index;
  /** Called with the typed text when the player submits it. */
  onSubmitText: (text: string, setHint: (hint: string) => void, showChoices: (entries: Entry[]) => void) => void;
  /** Called when the player picks a suggestion: that exact entry is the answer. */
  onPick: (entry: Entry, text: string) => void;
  labelledBy: string;
  onTextChange?: (text: string) => void;
}

/** A text input with autocomplete over the whole universe (never only the valid answers). */
export function AnswerInput({ index, onSubmitText, onPick, labelledBy, onTextChange }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [hint, setHint] = useState('');
  const [choices, setChoices] = useState<Entry[] | null>(null);
  const [picked, setPicked] = useState<Entry | null>(null);
  const [shake, setShake] = useState(0); // bumped to replay a short shake when a name needs a second look (two alternating keyframes restart it without remounting the input)

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const suggestions: Suggestion[] = useMemo(
    () => (choices ? choices.map((entry) => ({ entry, matchedAlias: null })) : suggest(index, text, 6)),
    [index, text, choices],
  );
  const showList = open && suggestions.length > 0;

  // Tell screen reader users how many suggestions there are, once typing pauses.
  useEffect(() => {
    if (!showList || choices) return;
    const t = setTimeout(() => announce(`${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`), 600);
    return () => clearTimeout(t);
  }, [showList, suggestions.length, choices, announce]);

  const change = (value: string): void => {
    setText(value);
    setChoices(null);
    setPicked(null);
    setHint('');
    setOpen(value.trim() !== '');
    setActive(-1);
    onTextChange?.(value);
  };

  const pick = (s: Suggestion): void => {
    setText(s.entry.name);
    setPicked(s.entry);
    setChoices(null);
    setHint('');
    setOpen(false);
    setActive(-1);
    onTextChange?.(s.entry.name);
    inputRef.current?.focus();
  };

  const submit = (): void => {
    setOpen(false);
    if (picked && picked.name === text) {
      onPick(picked, text);
      return;
    }
    onSubmitText(text, (h) => {
      setHint(h);
      setShake((n) => n + 1);
    }, (entries) => {
      setChoices(entries);
      setOpen(true);
      setActive(0);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = showList ? suggestions[active] : undefined;
      if (chosen) pick(chosen);
      else submit();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const optionId = (i: number): string => `${id}-option-${i}`;
  return (
    <div className="answer">
      <label htmlFor={`${id}-input`} className="answer__label">
        Your answer
      </label>
      <div className={`answer__row${shake > 0 ? ` shake shake--${shake % 2}` : ''}`}>
        <input
          ref={inputRef}
          id={`${id}-input`}
          className="answer__input"
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          aria-describedby={`${hintId} ${labelledBy}`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          value={text}
          placeholder="Type a name"
          onChange={(e) => change(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(text.trim() !== '')}
        />
        <button type="button" className="primary answer__submit" onClick={submit}>
          Answer
        </button>
      </div>
      <p id={hintId} className="answer__hint" role="status">
        {hint}
      </p>
      <ul id={listId} role="listbox" aria-label="Suggestions" className="suggestions" hidden={!showList}>
        {suggestions.map((s, i) => (
          <li
            key={s.entry.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            className={`suggestion${i === active ? ' suggestion--active' : ''}`}
            // mousedown, not click: the input must not lose focus (and close the list) before the pick lands
            onMouseDown={(e) => {
              e.preventDefault();
              pick(s);
            }}
          >
            <span className="suggestion__name">{s.entry.name}</span>
            <span className="suggestion__meta">
              {s.matchedAlias ? `also "${s.matchedAlias}" · ` : ''}
              {s.entry.kind === 'team' ? 'Team' : 'Player'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
