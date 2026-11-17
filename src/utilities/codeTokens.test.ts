import { describe, expect, it } from "vitest";
import { sandboxStreams, splitExitCode, tokenizePython } from "./codeTokens";

const kinds = (code: string) => tokenizePython(code).filter((t) => t.kind !== "plain").map((t) => [t.kind, t.text]);

describe("tokenizePython", () => {
  it("finds keywords, strings, numbers and comments", () => {
    expect(kinds('def f(x):\n    return x * 2.5  # double\nprint(f"{x}")')).toEqual([
      ["keyword", "def"],
      ["keyword", "return"],
      ["number", "2.5"],
      ["comment", "# double"],
      ["string", 'f"{x}"'],
    ]);
  });

  it("leaves built-in functions such as print plain", () => {
    expect(kinds("print(1)")).toEqual([["number", "1"]]);
  });

  it("keeps a hash inside a string and a quote inside a comment", () => {
    expect(kinds("s = '#not' # it's")).toEqual([
      ["string", "'#not'"],
      ["comment", "# it's"],
    ]);
  });

  it("reads triple-quoted strings and never loses text", () => {
    const code = 'x = """a\nb"""\nfor i in range(3): pass';
    expect(tokenizePython(code).map((t) => t.text).join("")).toBe(code);
    expect(kinds(code)[0]).toEqual(["string", '"""a\nb"""']);
  });

  it("does not colour digits inside names", () => {
    expect(kinds("var2 = 1")).toEqual([["number", "1"]]);
  });
});

describe("splitExitCode", () => {
  it("takes the exit line off the output", () => {
    expect(splitExitCode("ok\n\n[Command succeeded with exit code 0]")).toEqual({ body: "ok", exitCode: 0 });
    expect(splitExitCode("err\n[Command failed with exit code 127]\n")).toEqual({ body: "err", exitCode: 127 });
  });

  it("leaves other output alone", () => {
    expect(splitExitCode("no footer")).toEqual({ body: "no footer", exitCode: null });
  });
});

describe("sandboxStreams", () => {
  it("splits stdout and stderr, drops the wrappers and the blank lines", () => {
    expect(sandboxStreams("<stdout>a\n\n</stdout>\n<stderr>b\n\n\nc</stderr>")).toEqual([
      { stream: "stdout", text: "a" },
      { stream: "stderr", text: "b\nc" },
    ]);
  });

  it("keeps plain output as stdout", () => {
    expect(sandboxStreams("717897987691852588770249")).toEqual([{ stream: "stdout", text: "717897987691852588770249" }]);
  });
});
