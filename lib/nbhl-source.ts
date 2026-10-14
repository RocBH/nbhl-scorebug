export function decodeSingleQuotedJavaScript(value: string) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") {
      output += character;
      continue;
    }
    const next = value[++index];
    if (next === undefined) break;
    if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "v") output += "\v";
    else if (next === "0") output += "\0";
    else if (next === "x") {
      output += String.fromCharCode(Number.parseInt(value.slice(index + 1, index + 3), 16));
      index += 2;
    } else if (next === "u") {
      output += String.fromCharCode(Number.parseInt(value.slice(index + 1, index + 5), 16));
      index += 4;
    } else output += next;
  }
  return output;
}

