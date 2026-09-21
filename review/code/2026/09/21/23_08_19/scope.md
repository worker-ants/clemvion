# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 작업과 무관한 신규 백로그 항목 추가
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1921` (게이트 기준, "`spec/5-system` 4개 파일의 첫 섹션 헤딩이 `## Overview` 가 아니다" 항목)
  - 상세: 이번 PR 의 실제 목적은 `raceUnderHeldLock` 의 순수 동기 분기 둘을 테스트하는 것이지만, 착수 전 `--impl-prep` 게이트가 부수적으로 발견한 `spec/5-system` 문서 구조 편차(2026-05 이래 standing, 이번 diff 와 무관)를 같은 커밋에서 트래커에 등재했다. 다만 이는 실제 코드 수정이 아니라 **등재만**이며, `developer` 는 `spec/` 쓰기 권한이 없어 직접 고칠 수 없으므로 planner 인계용 기록을 남긴 것이다. plan 본문(§E)도 "이번 diff 가 유발한 것이 아니고", "이 PR 의 수렴 조건이 아니다" 라고 명시적으로 선을 긋고 있어, 조용히 스코프를 넓힌 것이 아니라 CLAUDE.md 가 요구하는 "권한 밖 발견사항은 트래커로 인계" 관행을 그대로 따른 것이다.
  - 제안: 조치 불요. 코드 변경이 아니므로 위반이 아니라 참고 사항으로만 기록.

- **[INFO]** `review/consistency/2026/09/21/{22_25_20,22_39_59}/**` 산출물 16개 파일이 diff 에 포함
  - 위치: `review/consistency/2026/09/21/22_25_20/*`, `review/consistency/2026/09/21/22_39_59/*` (신규 파일, 게이트 없음 — 전체가 추가)
  - 상세: 두 라운드(1차 `plan_coherence` CRITICAL 로 BLOCK → plan 개정 → 2차 BLOCK:NO)의 `--impl-prep spec/5-system` 산출물 전체가 커밋에 포함되어 diff 크기가 핵심 코드 변경(4개 파일, ~150줄)에 비해 상당히 크다. 그러나 CLAUDE.md 는 "코드 리뷰 산출물"·"일관성 검토 산출물" 을 `review/**` 아래 저장하도록 명시하고, `developer` 는 "구현 착수 직전 `consistency-check --impl-prep` 의무" 이므로 이 파일들은 요청 범위를 벗어난 추가가 아니라 **워크플로가 강제하는 감사 흔적**이다. 1차 BLOCK 라운드까지 보존한 것도 plan 자체가 "선례를 없는 곳에서 찾았다" 는 경위를 그대로 문서화하려는 의도로 보이며, 은폐가 아니라 투명성 쪽에 가깝다.
  - 제안: 조치 불요 — 규약이 요구하는 산출물이므로 스코프 위반 아님.

## 핵심 코드 변경(4개 파일) 평가

- `PROJECT.md` — §파일 위치 절에 self-spec 동반 헬퍼 예외 한 줄만 추가(4줄). plan §B-2 가 명시한, 이번 PR 이 유발한 BLOCK 을 닫기 위한 최소 문구이며 다른 부분은 건드리지 않음. 스코프 내.
- `codebase/backend/src/shared/testing/overlap-preconditions.ts` (신규) / `overlap-preconditions.spec.ts` (신규) — 요청된 작업(순수 함수 추출 + self-spec)과 정확히 일치. 프로덕션 런타임 소비처 없음(`tsconfig.build.json` exclude, plan §D 로 명시). 기능 확장·과잉 엔지니어링 없음 — export 는 딱 2개 함수, 시그니처도 기존 로직을 그대로 옮긴 것.
- `codebase/backend/test/helpers/concurrency.ts` — 최상위 `for` 루프와 `fires.length < 2` 인라인 가드를 새 함수 호출로 교체. JSDoc 도 SoT 중복을 없애기 위해 축약(내용은 신규 파일로 이관, 중복 제거 근거가 diff 안에 명시됨). 이 리팩터링은 "관련 없는 코드 정리"가 아니라 **바로 이번 작업이 요청한 추출** 그 자체이며, 그 외 함수(`raceUnderHeldLock` 본체, 락 오케스트레이션, JSDoc 예시)는 손대지 않음. import 추가도 실제로 즉시 사용됨(미사용 임포트 없음).
- `plan/in-progress/race-helper-guard-tests.md` (신규) — 작업 계획 문서. 워크플로가 요구하는 산출물.

포맷팅·주석 전용 변경이 실질 변경과 뒤섞인 흔적은 없음 — 남은 주석 변경(예: `VACUITY_GUARD_MS` JSDoc 축약)은 모두 리팩터링과 직접 연결된 SoT 이동이며, 무관한 주석 첨삭이 아님. 설정 파일(`jest.config.ts` 등) 변경은 diff 에 없음 — plan §D 가 명시한 "jest 설정 변경 0" 과 실제로 일치.

## 요약

핵심 코드 변경 4개 파일은 plan 이 예고한 범위(순수 전제 두 규칙을 `src/shared/testing/` 로 추출 + self-spec + 호출부 배선 + `PROJECT.md` 예외 문구 한 줄)와 정확히 일치하며, 요청 이상의 리팩터링·기능 확장·무관한 파일 수정·포맷팅 혼입·불필요한 주석/임포트 변경은 발견되지 않았다. diff 에 포함된 나머지 18개 파일(플랜/트래커 갱신 1건 + consistency-check 산출물 16개)은 이 프로젝트의 개발 워크플로(§0, developer 의무 §impl-prep, review/** 저장 규약)가 강제하는 프로세스 부산물이며, 임의로 스코프를 넓힌 정황은 없다. 유일하게 짚을 만한 점은 트래커에 이번 작업과 무관한 발견사항(spec Overview 헤딩 편차)을 등재한 것인데, plan 자체가 그것이 이 PR 의 수렴 조건이 아님을 명시하고 코드 수정 없이 인계만 했으므로 문제가 되지 않는다.

## 위험도

NONE
