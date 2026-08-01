import { describe, expect, it } from "vitest";
import { parseAiArray, parseAiJson } from "./parse";

describe("parseAiJson", () => {
  it("JSON polos", () => {
    expect(parseAiJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });
  it("dibungkus fense ```json", () => {
    expect(parseAiJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("fense tanpa label json", () => {
    expect(parseAiJson<{ a: number }>('```\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("ada prosa sebelum/sesudah JSON", () => {
    expect(parseAiJson<{ a: number }>('Berikut hasilnya: {"a":3} Sekian.')).toEqual({ a: 3 });
  });
  it("invalid → null", () => {
    expect(parseAiJson("{not json}")).toBeNull();
  });
  it("kosong → null", () => {
    expect(parseAiJson("")).toBeNull();
  });
});

describe("parseAiArray", () => {
  it("array polos", () => {
    expect(parseAiArray<string>('["a","b"]')).toEqual(["a", "b"]);
  });
  it("dibungkus prosa", () => {
    expect(parseAiArray<string>('Hasil: ["a"] Sekian.')).toEqual(["a"]);
  });
  it("invalid → null", () => {
    expect(parseAiArray('{bukan array}')).toBeNull();
  });
});
