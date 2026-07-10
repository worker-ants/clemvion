# Code Review 통합 보고서

## 전체 위험도
**NONE** — `asEnvelope`(`presentation.ts`) 의 `truncation` top-level 필드 흡수 1줄 fix + 3계층 회귀 테스트(84건 green) + 관련 spec 3파일 정정. CRITICAL/WARNING 없음, 전 항목 INFO(또는 LOW 등급 유지보수성 관찰)뿐.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `asEnvelope` 의 `truncation` 병합은 object-literal spread(`{ ...payload, ...asRecord(o.truncation) }`) 사용 — `Object.assign` 과 달리 `__proto__` own-key 가 있어도 프로토타입 오염 없이 안전. 소비 측도 `typeof`/`=== true` 엄격 검증만 수행 | `codebase/channel-web-chat/src/lib/presentation.ts:129` | 조치 불요. 향후 `Object.assign`/deep-merge 로 리팩터 시 prototype pollution 회귀 유의 |
| 2 | security | 신규 필드(`truncation.rowsTotalCount`/`itemsTotalCount`)는 렌더 대상 문자열/URL 로 소비되지 않음(고정 배너 문구만 사용) | `presentation.ts:186-204`(`toTable`) | 조치 불요 |
| 3 | requirement | 위젯 truncation 배너가 `rowsTotalCount`/`itemsTotalCount`(잘리기 전 총 개수)를 노출하지 않음 — 메인 FE(`assistant-presentations-block.tsx:316`)는 count 를 함께 표시하나 위젯은 `truncated: boolean`만 소비. 이 diff 가 만든 회귀 아니며 spec 도 count 표시를 강제하지 않음(범위 밖) | `presentation.ts:198-204`, `presentations.tsx:199` | 필요 시 별도 후속 과제로 `TableData`/`CarouselData` 에 `totalCount?: number` 추가 검토 — 이번 PR 스코프 밖 |
| 4 | requirement | `render_form`(type:`form`) 이 `PRESENTATION_KINDS` fast-path 에서 제외되어 위젯이 AI `render_form` 표시물을 렌더하지 않음 — 사전 존재 동작이며 spec(`1-widget-app.md` §2) 도 위젯 렌더 요구를 4종(carousel/table/chart/template)으로 한정해 모순 아님 | `presentation.ts:103-105` | 조치 불요(범위 밖). 향후 위젯 `render_form` 지원 계획 시 별도 plan 필요 |
| 5 | scope | 프로덕션 코드 수정은 `asEnvelope` 1개 함수, 실질 1줄에 국한(diff 1,133 insertions 중 production 코드 11줄) | `presentation.ts:107-217` | 조치 불요 |
| 6 | scope | spec 3파일(`1-widget-app.md`/`_product-overview.md`/`conversation-thread.md`) 동시 수정은 plan 사전 명시 범위(`1-widget-app.md`) + 동일 조사에서 나온 consistency-check WARNING/INFO 반영분(`_product-overview.md`/`conversation-thread.md`, plan Rationale R2-a 근거 기록) — 은닉된 스코프 확장 아님 | `spec/7-channel-web-chat/1-widget-app.md` 외 2건 | 조치 불요 |
| 7 | scope | `review/consistency/**` 16개 산출물은 CLAUDE.md 규약상 워크플로 의무 산출물로 코드 스코프 침범 아님 | `review/consistency/2026/07/10/{22_27_45,22_41_55}/**` | 조치 불요 |
| 8 | maintainability | 테스트 fixture 헬퍼 `payloadOf` 가 두 파일(`conversation.test.ts`, `presentations.test.tsx`)에 중복 정의되고 시그니처가 미묘하게 다름(`truncation` 옵션 인자 유무) | `conversation.test.ts:134-139`, `presentations.test.tsx` 내 `payloadOf` | 반복이 3번째 파일로 늘면 공용 fixture 빌더로 추출 권장. 현재는 위험 낮음 |
| 9 | maintainability | `asEnvelope` truncation 병합의 "값 충돌 시 truncation 이 우선" 이라는 우선순위가 주석/JSDoc 에 명시되지 않음 | `presentation.ts:126-131` | 주석에 "payload 와 truncation 이 같은 키를 가지면 truncation 이 우선"이라는 한 줄 추가 권장 |
| 10 | maintainability | 신규 테스트의 타임스탬프 매직 문자열(`"2026-07-10T00:00:00.000Z"`)이 두 파일에 반복 하드코딩 | `conversation.test.ts:137`, `presentations.test.tsx` 내 `payloadOf` | 필수 아님. `payloadOf` 통합 시 함께 상수화 |
| 11 | testing | `payload`/`truncation` 동명 필드 충돌(둘 다 존재하고 값이 다른 경우) 시 우선순위를 고정하는 테스트 없음 — 스프레드 순서를 바꾸는 향후 리팩터가 이를 조용히 뒤집어도 어떤 테스트도 red 전환 안 됨 | `presentation.ts:129`, `presentation.test.ts:204-245` | `payload.rowsTruncated:true` + `truncation.rowsTruncated:false` 같은 충돌 케이스 1건 추가해 우선순위 lock-in 권장 |
| 12 | testing | `toCarousel` 의 `itemsTruncated` 흡수는 "파싱을 깨지 않음"만 검증 — 실제 소비처(카루셀 잘림 배너)가 코드에 존재하지 않아 "동등 메타" 주석이 절반만 참 | `presentation.test.ts:226-235`, `presentation.ts:39`(`CarouselData` 에 `truncated` 필드 없음) | 이번 PR 스코프 밖. 카루셀 truncation 배너 구현 시 대칭 렌더 테스트 추가 필요 |
| 13 | testing | `truncation` 이 non-object 값(예: `"garbage"`/`null`)일 때 `asRecord` 가 안전하게 no-op 되는 방어 로직을 명시적으로 잠그는 테스트 없음(다른 필드는 유사 malformed-input 테스트 존재) | `presentation.ts:88-90`(`asRecord`), `129` | 선택 사항. `truncation: null` 1건 추가 권장 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `1-widget-app.md` §2 의 구 서술("복원 thread presentation 은 위젯이 graceful 하게 무시")은 실측과 어긋난 낡은 spec 문구였음(#874 가 실측 없이 추가). 코드(`asEnvelope` 의 `PresentationPayload` 분기, #707 도입)는 이미 옳았고 spec 만 뒤처져 있었음 — **이번 PR 의 `docs(spec)` 커밋(`28a358375`)에서 이미 정정·해소됨** | `spec/7-channel-web-chat/1-widget-app.md` §2 presentation 행 | 추가 조치 불필요 — 기록 목적으로만 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 프로덕션 변경은 `asEnvelope` 1줄뿐. spread 병합 안전(prototype pollution 없음), 인젝션/시크릿/인증 이슈 없음 |
| requirement | NONE | spec(`0-common.md` §10.4, `ai-agent.md` §7.10) 이 이미 규정한 계약을 코드가 뒤늦게 충족. 84건 테스트 전부 green. SPEC-DRIFT 1건 이미 같은 PR 에서 해소 확인 |
| scope | NONE | 24개 변경 파일 전량 대조 결과 payload 밖 숨은 변경 없음. spec 3파일 수정도 근거 문서화됨 |
| maintainability | LOW | 테스트 헬퍼 경미한 중복, 병합 우선순위 문서화 누락 등 INFO 3건 |
| testing | LOW | 3계층 회귀 테스트 84건 green. 충돌 우선순위 미고정·카루셀 비대칭·non-object 방어 미검증 등 INFO 3건(전부 저위험) |
| documentation | 재시도 필요 | output 파일(`documentation.md`) 이 `success` 로 보고됐으나 디스크에 부재 — 결과 확인 불가 |
| side_effect | 재시도 필요 | output 파일(`side_effect.md`) 이 `success` 로 보고됐으나 디스크에 부재 — 결과 확인 불가 |

## 발견 없는 에이전트

- security, requirement, scope — 모두 위험도 NONE, CRITICAL/WARNING 없이 INFO 또는 SPEC-DRIFT 참고만 존재.

## 권장 조치사항

1. (재확인) `documentation`, `side_effect` reviewer 는 `success` 로 보고됐으나 output 파일이 디스크에 존재하지 않음(worktree 전체 및 세션-root 오작성 가능 경로까지 검색했으나 부재 확인) — 재시도하여 결과를 확보할 것. 단, 나머지 5개 reviewer(security/requirement/scope/maintainability/testing) 전원이 CRITICAL/WARNING 없이 NONE~LOW 로 수렴했고, 변경 스코프가 `asEnvelope` 1줄 + 회귀 테스트 + spec 정정으로 매우 좁게 확인되어 documentation/side_effect 재시도가 이 결론을 뒤집을 가능성은 낮음.
2. (선택, 저우선) `asEnvelope` truncation 병합 로직에 "충돌 시 truncation 우선" 주석 1줄 추가 + 해당 충돌 케이스 테스트 1건 추가.
3. (선택, 저우선) `payloadOf` 테스트 헬퍼 중복은 3번째 파일로 반복이 늘어날 때 공용 fixture 빌더로 추출 검토.
4. SPEC-DRIFT 1건은 이미 이번 PR 내에서 해소됐으므로 추가 조치 불필요(기록만 유지).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (전원 — 소스 코드 변경 시 상시 적용 규칙 + 문서/spec 변경 규칙에 의해 강제 포함됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(순수 함수 1줄 흡수 + 테스트)과 무관 |
  | architecture | 아키텍처 경계·모듈 구조 변경 없음 |
  | dependency | 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성/비동기 로직 변경 없음 |
  | api_contract | 외부 API 계약 변경 없음(내부 프런트 순수 함수 변경) |
  | user_guide_sync | 최종 사용자 가이드 문서 영향 없음(spec/개발 문서만 변경) |

---

## ⚠️ main Claude 정정 (workflow disk-write 갭)

위 표의 **`WARNING=0` 집계는 부정확**하다. `documentation`·`side_effect` reviewer 는 `status=success` 였으나
지정 `output_file` 이 디스크에 쓰이지 않아(기지 workflow disk-write 갭) summary agent 가 두 리뷰어를
"재시도 필요" 로 두고 카운트에서 제외했다. main 이 workflow journal 에서 원문을 복구한 결과:

| reviewer | 실제 등급 | 발견 |
|---|---|---|
| documentation | **WARNING 1** + INFO 3 | 파일 상단 모듈 헤더 주석이 `truncation?` 필드를 누락해 `asEnvelope` JSDoc 과 shape 정의가 불일치(stale 주석). INFO: TS 주석 내 마크다운 링크 문법이 파일 관례와 불일치 |
| side_effect | INFO 3 (NONE 등급) | `output` 에만 truncation 병합 → `config`/`output` 대칭 깨짐. 현재 키 충돌 없음이 확인됐으나 코드에 assert/테스트로 고정돼 있지 않음. 소비처는 `presentations.tsx` 1곳으로 blast radius 국한 확인 |

**따라서 실제 집계 = RISK: LOW, CRITICAL: 0, WARNING: 1.** developer skill §REVIEW WORKFLOW 에 따라
WARNING 1건 + 관련 INFO 를 같은 턴에 fix 하고 `RESOLUTION.md` 에 기록한다.
