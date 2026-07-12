# Code Review 통합 보고서

## 전체 위험도
**NONE** — `disclaimer` 안내 문구를 3개 파일(데모 기본값·SDK 예제·spec 예시)에서 해요체("…있어요")로 통일하는 순수 카피(copy) 변경. 로직·타입·API 계약·상태 관리·테스트 어느 것도 건드리지 않으며, 완료된 6개 리뷰어 전원이 위험도 NONE·발견사항 없음으로 수렴했다. 단, `scope` 리뷰어는 `status=success` 로 보고됐으나 산출 파일(`scope.md`)이 디스크에 존재하지 않아(Workflow disk-write 갭) 내용을 확인할 수 없다 — 아래 "재시도 필요" 및 권장 조치사항 참고.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | 동일 disclaimer 문자열이 3개 파일(데모 기본값 / SDK 예제 HTML / spec 예시 코드블록)에 리터럴로 중복 기재됨. 이번 diff는 기존 drift(세 값이 서로 다르던 상태)를 해소하는 방향이라 문제를 만들지는 않으나, SoT 부재로 향후 재변경 시 수동 동기화 부담은 여전함 | `demo-config.ts:74`, `snippet.html:163`, `2-sdk.md:248` | 현시점 리팩터링 불요. 문구 재변경 가능성이 높다면 `2-sdk.md`를 SoT로 명시하고 나머지를 "동기화 대상" 주석 처리 |
| 2 | maintainability | 문체가 해요체로 통일되어 위젯 UI 카피의 기존 관례(PR #921 계열)와 일관성 확보 | 3개 파일 동일 | 없음 — 개선 방향 |
| 3 | documentation | 이번 변경이 직전 `consistency-check`(`review/consistency/2026/07/12/01_41_42/convention_compliance.md`) 가 보고한 WARNING(`i18n-userguide.md` Principle 6 해요체 위반)을 정확히 해소함을 확인 — 4개 canonical 소스(`demo-config.ts`/`snippet.html`/`2-sdk.md`/기존 해요체였던 `web-chat-sdk.mdx`) 전수 바이트 단위 일치 | 위 3개 파일 + `web-chat-sdk.mdx:50` | 조치 불요 |
| 4 | documentation | diff 범위 밖 인접 파일 `widget-app.test.tsx` 의 테스트 픽스처가 여전히 합니다체(`"AI는 한정된 데이터로 동작합니다."`). 기능적 문제 아니고 canonical 기본값과 동기화 의무 없는 독립 픽스처이며, `channel-web-chat` 은 frontend hardcoded-korean 가드 스코프 밖 | `widget-app.test.tsx:44,53` | 강제 아님. 후속 기회에 해요체로 통일하면 grep 기반 재발 방지에 도움 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/인증/시크릿 영향 없는 정적 문자열 교체 |
| requirement | NONE | 3파일 byte-identical 동기화 확인, i18n-userguide Principle 6 준수 방향 정합화(회귀 아님) |
| side_effect | NONE | 상태/시그니처/인터페이스/네트워크/이벤트 어느 것도 무변경 |
| maintainability | NONE (INFO 2건) | 3파일 리터럴 중복(기존 패턴, 문제 아님), 문체 통일로 일관성 개선 |
| testing | NONE | 기존 테스트가 리터럴에 하드코딩 의존 없음을 실행 확인(17/17 통과), 추가 테스트 불요 |
| documentation | NONE (INFO 3건) | consistency WARNING 정확히 해소, 인접 스코프 밖 픽스처 1건 잔존(무해) |
| scope | 확인 불가 | `status=success` 보고됐으나 `scope.md` 파일이 디스크에 부재(Workflow disk-write 갭) — 재시도 필요 |

## 발견 없는 에이전트

security, requirement, side_effect, testing (INFO 포함 전 항목이 "없음"/"조치 불요"로 수렴)

## 권장 조치사항

1. **[프로세스]** `scope` 리뷰어를 재실행해 실제 산출물을 확보할 것 — `status=success` 로 보고됐음에도 `scope.md` 가 세션 디렉터리에 생성되지 않은 Workflow disk-write 갭(과거 PR #901 유사 사례, `feedback_workflow_disk_write_gap_false_counts` 참고)이며, 완료된 6개 리뷰어가 전원 NONE 이라는 사실이 scope 리뷰어의 결과를 대신 보증하지 않는다.
2. **[선택, 비차단]** `widget-app.test.tsx` 의 잔존 합니다체 픽스처 문구를 향후 기회에 해요체로 통일(강제 아님, scope 밖).
3. **[선택, 비차단]** disclaimer 문구가 향후 재변경될 가능성이 높다면 `2-sdk.md`를 SoT로 명시하는 주석을 3개 표면에 추가 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (소스 코드 변경(`demo-config.ts`) + spec 문서 변경(`2-sdk.md`) 이 항상-적용 조건을 트리거 — 7명 전원 강제 포함이며 router 자체 선별 배제는 없음)
  - **제외**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 UI 카피 텍스트 변경 — 성능 영향 경로 없음(router 판단) |
  | architecture | 구조/설계 변경 없는 리터럴 교체 |
  | dependency | 의존성 변경 없음 |
  | database | DB 접근 경로 무관 |
  | concurrency | 동시성/비동기 흐름 무관 |
  | api_contract | 공개 API/스키마 변경 없음(`disclaimer` 는 기존 선택 필드, 타입 불변) |
  | user_guide_sync | 사용자 가이드 동기화 대상 아님(웹챗 위젯은 hardcoded-korean 가드·doc-sync-matrix 스코프 밖) |

---

## 검증 노트 (main Claude, 후속)

`scope` 리뷰어의 `scope.md` 디스크 부재(Workflow disk-write 갭)는 **재시도 없이 journal.jsonl 복구로 해소**했다 (`feedback_workflow_disk_write_gap_false_counts` 절차). journal 의 scope 반환 전문 확인 결과 **위험도 NONE, [INFO] 2건(모두 "조치 불필요")** 이며 WARNING/CRITICAL 은 없다 — 따라서 통합 카운트 CRITICAL=0 / WARNING=0 은 신뢰 가능하고 누락된 발견은 없다.

- scope [INFO] 요지: 3개 파일 1-line disclaimer 문구 통일은 정확한 스코프(무관 변경 없음). 인접 `widget-app.test.tsx:44,53` 의 합니다체 픽스처는 렌더링 검증용 mock 이지 disclaimer SoT 미러가 아니며 `channel-web-chat` 은 hardcoded-korean 가드 스코프 밖이라 이번 diff 대상 아님(documentation INFO #4 와 동일 판단).
- 전체 7개 리뷰어(security·requirement·scope·side_effect·maintainability·testing·documentation) 모두 NONE 수렴. resolution-applier 불요.
