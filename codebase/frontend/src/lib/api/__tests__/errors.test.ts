import { describe, it, expect } from "vitest";
import type { AxiosError } from "axios";
import {
  axiosMessage,
  extractApiCode,
  extractApiDetails,
  extractApiMessage,
  type ApiErrorBody,
} from "../errors";

/*
 * 오류 응답 본문 읽기. 서버의 전역 예외 필터는 `{error:{code,message,details}}` 로 감싸서 내고, 평탄한
 * `{code,message}` 를 내는 경로도 있어 둘 다 읽는다.
 */

const axiosError = (data: ApiErrorBody | undefined) =>
  ({
    response: data === undefined ? undefined : { data },
  }) as AxiosError<ApiErrorBody>;

describe("extractApiCode · extractApiMessage · extractApiDetails", () => {
  it("감싼 응답에서 코드 · 문구 · details 를 꺼낸다", () => {
    const err = axiosError({
      error: {
        code: "MAKESHOP_INSTALL_PENDING",
        message: "서버 문구",
        details: { pendingInstallExpiresAt: "2026-10-29T09:00:00.000Z" },
      },
    });
    expect(extractApiCode(err)).toBe("MAKESHOP_INSTALL_PENDING");
    expect(extractApiMessage(err)).toBe("서버 문구");
    expect(extractApiDetails(err)).toEqual({
      pendingInstallExpiresAt: "2026-10-29T09:00:00.000Z",
    });
  });

  it("평탄한 응답에서도 꺼낸다", () => {
    const err = axiosError({
      code: "ADMIN_REQUIRED",
      message: "서버 문구",
      details: { a: 1 },
    });
    expect(extractApiCode(err)).toBe("ADMIN_REQUIRED");
    expect(extractApiMessage(err)).toBe("서버 문구");
    expect(extractApiDetails(err)).toEqual({ a: 1 });
  });

  it("평탄한 값이 감싼 값보다 앞선다", () => {
    const err = axiosError({
      code: "OUTER",
      details: "outer",
      error: { code: "INNER", details: "inner" },
    });
    expect(extractApiCode(err)).toBe("OUTER");
    expect(extractApiDetails(err)).toBe("outer");
  });

  it("응답이 없으면 모두 undefined", () => {
    const err = axiosError(undefined);
    expect(extractApiCode(err)).toBeUndefined();
    expect(extractApiMessage(err)).toBeUndefined();
    expect(extractApiDetails(err)).toBeUndefined();
  });
});

/*
 * NERV Task `CLE-T-MFWBE1` 항목 2 — `axiosMessage` 는 `data.message` 만 읽어 감싼 응답의 문구를 놓쳤다.
 * 그래서 화면에는 axios 의 "Request failed with status code …" 가 보였다.
 */
describe("axiosMessage", () => {
  const axiosLike = (data: ApiErrorBody | undefined, message = "Request failed with status code 409") =>
    Object.assign(new Error(message), {
      isAxiosError: true,
      response: data === undefined ? undefined : { status: 409, data },
    });

  it("감싼 응답의 error.message 를 쓴다", () => {
    const err = axiosLike({ error: { code: "RESOURCE_CONFLICT", message: "서버 문구" } });
    expect(axiosMessage(err, "기본 문구")).toBe("서버 문구");
  });

  it("평탄한 응답의 message 도 쓴다", () => {
    const err = axiosLike({ code: "X", message: "평탄한 문구" });
    expect(axiosMessage(err, "기본 문구")).toBe("평탄한 문구");
  });

  it("응답 본문이 없으면 axios 오류 문구, 그것도 없으면 기본 문구다", () => {
    expect(axiosMessage(axiosLike(undefined, "Network Error"), "기본 문구")).toBe("Network Error");
    expect(axiosMessage(axiosLike(undefined, ""), "기본 문구")).toBe("기본 문구");
  });

  it("axios 오류가 아니면 Error 문구, 그 밖의 값이면 기본 문구다", () => {
    expect(axiosMessage(new Error("boom"), "기본 문구")).toBe("boom");
    expect(axiosMessage("x", "기본 문구")).toBe("기본 문구");
  });
});
