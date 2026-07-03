export function setLoadingState(button, isLoading) {
  if (!button) {
    return;
  }
  button.disabled = Boolean(isLoading);
}
