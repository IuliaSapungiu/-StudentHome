// One-shot requests from other screens to the Search screen, kept pure so they can be tested.
//
//  - focusRequested: "open the keyboard on arrival" (only the Home "Find your home" search bar asks for it). It is
//    CONSUMED by Search the moment it acts, so a later visit (coming back from Filters, map mode, a re-mount) can
//    never re-open the keyboard. When there is no pending request, arriving at Search closes any open keyboard.
//  - scrollResetToken: increases only when a NEW search is started from a preset (a popular city, "near my university",
//    a budget shortcut). Search gives its result list a new identity for each token, so the new search starts at the
//    top; ordinary filter changes never touch it, so they never move the list.

export type SearchRequests = { focusRequested: boolean; scrollResetToken: number };

export const initialSearchRequests: SearchRequests = { focusRequested: false, scrollResetToken: 0 };

/** A preset (new search) was applied. A focus request is set only when the caller asked for it. */
export const onPresetApplied = (prev: SearchRequests, opts?: { focus?: boolean }): SearchRequests => ({
  focusRequested: opts?.focus === true,
  scrollResetToken: prev.scrollResetToken + 1,
});

/** Search has acted on the focus request. */
export const consumeFocus = (prev: SearchRequests): SearchRequests => (prev.focusRequested ? { ...prev, focusRequested: false } : prev);

export type FocusAction = 'focus' | 'dismiss';
/** What Search does with the keyboard each time its screen comes into focus. */
export const focusActionOnArrival = (r: SearchRequests): FocusAction => (r.focusRequested ? 'focus' : 'dismiss');
