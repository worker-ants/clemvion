# 문서화(Documentation) 리뷰 — `system_error` 배너 라이브 WS 복구 (6라운드 누적 diff, `02_57_18`)

## 배경 및 검증 방법

이 diff(`origin/main...HEAD`, 6 커밋)는 이미 5 라운드의 `/ai-review`(`01_26_11` → `01_44_22`
→ `02_02_18` → `02_21_19` → `02_39_10`)를 거쳤고, 매 라운드 documentation 관점 발견사항이
해당 RESOLUTION.md 대로 반영됐다. 이번 라운드의 실질 델타(커밋 `efc04a194`, `02_39_10` W1
fix)는 **테스트 파일만** 80줄 추가하는 순수 테스트 변경이며 `use-execution-events.ts` 소스는
무변경이다(`git show efc04a194 --stat` 로 확인).

직접 확인한 항목:
- `codebase/frontend/src/lib/websocket/use-execution-events.ts` 를 `Read` 로 전체 재확인 —
  `extractNodeErrorPayload` JSDoc(58-83행), `handleNodeCompleted`(807-812행 부근) ·
  `handleNodeFailed`(842-849행) 주석이 모두 `§4.1-a` / `output.output.error` 서술로 정확히
  갱신돼 있고, 구현(84-100행)과 완전히 일치함을 확인.
- 이번 라운드 신규 테스트 3건(`details` 타입 가드 캐너리, `use-execution-events.test.ts`
  `wrapNodeHandlerOutput` 블록 내부, 커밋 `efc04a194`)의 docstring 을 코드와 대조 —
  라운드 참조(`02_39_10` W1)·뮤테이션 예측/실측·"두 핸들러 모두" 근거가 실제 구현과 일치.
- `pnpm/npx vitest run` 로 대상 스위트 직접 실행 — **95/95 PASS**, `plan/in-progress/
  system-error-banner-live-ws.md:62` 의 "86→95" 실측값과 일치(직접 재확인, 프록시 아님).
- `spec/5-system/6-websocket-protocol.md` 에 `§4.1-a`(239행) 섹션이 실제로 존재함을
  `grep` 으로 확인 — 코드 주석의 SoT 인용이 유효.
- `CHANGELOG.md` Unreleased 항목("`system_error` 재시도 배너가 라이브 실행에서 처음 뜬다")이
  운영 영향·회귀 아님을 명시하며 실제 코드 변경과 일치.

## 발견사항

없음 (신규 CRITICAL/WARNING/INFO 없음).

## 참고 — 기존 라운드에서 이미 식별·유예된 carry-over (재조치 불요)

- `handleNodeFailed` 의 `output?: unknown` 파라미터 선언 위 주석(863-866행 부근, "엔진은
  실패 시에도 `nodeExec.outputData` 를 영속하고... `output.error` + 부분 `output.result.*`
  병존")이 15줄 위 `§4.1-a` wire-레벨 주석과 표면적으로 다른 자리를 가리키는 것처럼 읽힐
  여지가 있다는 지적이 `02_21_19`·`02_39_10` documentation 리뷰에서 3~4라운드 연속
  "조치 불요(유예 유지)"로 판정됐다. 이번 라운드도 소스가 무변경이므로 같은 판정을 유지한다.
- `payload.error?: string | { code, message, details? }` 타입 선언(handleNodeFailed 상단)이
  `extractNodeErrorPayload` JSDoc 의 "객체 `error` 분기는 지웠다" 서술과 표면적 긴장이
  있다는 지적이 `02_02_18` maintainability/requirement 리뷰에서 이미 식별됐고, `errorMessage`
  status 텍스트 계산만을 위한 방어적 타이핑이며 `01_44_22` RESOLUTION #5(공유
  `NodeHandlerOutput` 타입 부재)와 같은 뿌리로 유예됨 — 이번 라운드도 소스 무변경이라
  재조치 대상 아님.
- PR 본문에 "이 배포 이후 사용자가 처음 배너를 본다 — 회귀 아님" 문구 포함은 여러 라운드가
  약속했고 PR 생성 시점에 이행될 항목 — 이 저장소 컨벤션상 리뷰 코드 자체의 결함이 아니다.

## 요약

이 PR 은 5라운드에 걸쳐 documentation 관점 발견사항(JSDoc-함수 인접성 분리, 낡은 §4.1 인용,
자매 호출부 주석 잔존, 테스트 제목/describe 주석 shape 불일치, CHANGELOG 누락, fixture 손
복제)이 전부 소진·반영된 상태다. 이번 6라운드의 실질 변경은 소스를 건드리지 않는 순수 테스트
추가(`details` 타입 가드 캐너리 3건)이며, 신규 docstring 을 실제 구현과 직접 대조해 정확함을
확인했다. `plan/in-progress/system-error-banner-live-ws.md` 의 테스트 카운트("86→95")도
`vitest run` 직접 실행으로 95/95 를 재확인해 프록시가 아닌 실측과 일치한다. 남은 두 항목은
3~4라운드 연속 이미 식별·유예된 carry-over(소스 무변경이라 이번 라운드 재조치 대상 아님)뿐이며,
새로운 CRITICAL/WARNING/INFO 는 없다.

## 위험도

NONE
