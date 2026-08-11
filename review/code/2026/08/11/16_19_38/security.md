# 보안(Security) Review — 델타 `df1375208` 확인

## 확인 절차

- `git show df1375208`: `codebase/channel-web-chat/src/widget/use-widget.ts` 1 파일, +10/-2, 실행 코드 변경 0줄(주석/JSDoc 전용) — 커밋 메시지 주장과 일치.
- 변경 두 곳:
  1. `configFromQuery()` 함수 JSDoc(구 `/** boot config 를 query param 으로 폴백 해석(host 없이 직접 로드/샘플 대비). */` → "모든 임베드에서 발동한다" + SoT `4-security.md §1` 명시)
  2. 직접 로드 폴백 호출부 위 인라인 주석(구 `// host 없이 직접 로드(샘플/개발): ...` → "host 유무를 검사하지 않는다 / 샘플 전용으로 읽고 지우면 전부 깨진다")
- `grep -n "샘플" use-widget.ts` → 현재 파일에 남은 2건 모두 **부정문**("전용이 아니다", "지우면 깨진다")으로, 지적했던 "샘플 전용"이라는 단정적 서술은 더 이상 존재하지 않는다. 복제본이 정확히 2곳이라는 처분 근거도 grep 결과와 일치한다.

## 4자리 배선 불변성 확인

- `safeApiBase(raw, source)` (204~217행): 시그니처·본문(`if (!raw) return undefined` → `new URL` 파싱 → `http:`/`https:` 스킴 검사 → 실패 시 `console.warn` 후 `undefined`) 동일.
- `configFromQuery()` (226~233행): `safeApiBase(q.get("apiBase"), "configFromQuery")` 호출 그대로. JSDoc만 교체됨.
- `mergeBootConfig(fromQuery, boot)` (241~252행): `{ ...fromQuery, ...boot }` 병합 후 `merged.apiBase = safeApiBase(boot.apiBase, "wc:boot") ?? fromQuery.apiBase` 로 boot 값을 재검증하고 쿼리 값으로 폴백하는 로직 불변.
- 호출부/폴백 (1348~1388행): `bridge.onBoot((c) => runApplyConfig(mergeBootConfig(configFromQuery(), c)))` 및 `const fallback = configFromQuery(); if (fallback.apiBase && fallback.triggerEndpointPath) runApplyConfig(fallback as BootMessage);` 조건·순서 동일. 주석만 교체.

## 발견사항

없음. 직전 라운드 INFO(코드 주석이 spec 이 명확히 배제한 "샘플/직접 로드 전용" 해석을 유도)는 해소됐고, 이번 편집은 검증 술어·병합 로직·호출 순서 등 실행 경로에 손대지 않았다.

## 요약

`df1375208` 은 문서/주석 정정에 한정된 순수 non-functional 변경이다. `safeApiBase`/`configFromQuery`/`mergeBootConfig`/호출부-폴백 4자리 배선은 바이트 단위로 이전과 동일하며(주석 라인만 교체), 스킴 검증·boot 우선순위·쿼리 폴백 순서 등 보안에 관련된 실행 동작에는 변화가 없다. 새로 도입된 취약점 없음.

## 위험도

NONE
STATUS: OK
