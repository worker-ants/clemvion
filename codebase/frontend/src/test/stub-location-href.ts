import { vi } from "vitest";

/**
 * jsdom 은 `window.location.href` 대입으로 이동하지 않는다. 대입 값만 가로채 `assign` 에 모으고
 * `restore` 로 원래 `location` 을 되돌린다. OAuth 시작처럼 `location.href = …` 로 떠나는 코드를
 * 확인할 때 쓴다.
 */
export function stubLocationHref() {
  const assign = vi.fn();
  const original = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...original,
      set href(v: string) {
        assign(v);
      },
    },
  });
  return {
    assign,
    restore: () =>
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      }),
  };
}
