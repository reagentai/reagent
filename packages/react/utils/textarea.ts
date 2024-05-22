const adjustTextareaHeight = (
  node: HTMLTextAreaElement,
  message: string,
  options: {
    defaultLines?: number;
    maxLines?: number;
  } = {}
) => {
  if (!node) return;
  node.innerText = message;
  // at least 1 line if default not set
  const linesCount = Math.min(
    Math.max(message.split("\n").length, options.defaultLines || 1),
    options.maxLines || Infinity
  );
  var s = getComputedStyle(node);
  let height =
    parseFloat(s.paddingTop) +
    parseFloat(s.paddingBottom) +
    parseFloat(s.borderTopWidth) +
    parseFloat(s.borderBottomWidth);
  height += parseFloat(s.lineHeight) * linesCount;
  node.style.height = height + "px";
};

export { adjustTextareaHeight };
