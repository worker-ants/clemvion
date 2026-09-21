# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. `ModelConfigService.remove()` 동시 DELETE 중복 감사 로그 수정(형제 8번째 자리)은 검증된 패턴을 정확히 재사용해 기능·보안·동시성 관점에서 새 결함이 없다. 다만 문서화 관점 WARNING 2건(CHANGELOG 관례 누락 + 기존 CHANGELOG 항목에 이미 반증된 서술 잔존)과 유지보수성 WARNING 1건(e2e 중복, 단 문서화된 기존 유예 결정)이 있어 NONE 이 아닌 LOW 로 판정한다. **forced whitelist(router_safety) 7개 reviewer 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 동일 결함 클래스(동시 DELETE→감사 중복) 형제 6건(#1369~#1374) 전부가 지켜온 `CHANGELOG.md` 갱신 관례를 이번 PR(8번째)만 건너뜀. 과거 한 번은 이 관례를 빠뜨렸다가 전용 백필 커밋(`197425f51`)까지 만든 전례가 있어 프로젝트가 이 관례를 가볍게 보지 않음이 git 이력으로 확인됨 | `CHANGELOG.md` (이번 3개 커밋 어느 것도 수정 안 함), `plan/in-progress/modelconfig-dup-delete.md` 체크리스트에도 항목 없음 | 형제 형식과 동일하게 `## Unreleased — …` 항목 추가, 또는 의도적 유예라면 plan 체크리스트에 사유 명시 |
| 2 | documentation | `CHANGELOG.md`(7번째 형제 커밋이 남긴 예고)가 이번 PR이 스스로 실측 반증한 과장된 서술("`notifyInvalidated` 캐시 무효화 통지 중복까지 함께 있음")을 정정 없이 그대로 유지. 트래커 문서(`spec-draft-nullable-notation-followups.md`)는 이번 diff로 정정됐지만 배포 이력에 남는 CHANGELOG는 손대지 않음 | `CHANGELOG.md:40-41` | 이번 PR의 CHANGELOG 항목 추가 시 직전 형제 항목에 각주/취소선으로 정정, 또는 새 항목에 "직전 서술은 과장이었다" 한 줄 명시 |
| 3 | maintainability | 신규 e2e 동시성 테스트(`model-config-delete-concurrency.e2e-spec.ts`)가 형제 파일(`auth-config-delete-concurrency.e2e-spec.ts` 등)과 리소스명·라우트·에러코드만 다를 뿐 구조·주석·변수명·락 기법·정리 로직이 거의 전문 동일. 현재 이 패턴 파일이 9개(공용 헬퍼 없이 매번 복사-치환) | `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (전체) | 차단 사유 아님 — plan(`§"이 PR 이 하지 않는 것"`)에 "9번째(WebAuthn)와 함께 재검토"로 이미 명시 유예됨. 다음(9번째) 착수 시 실제로 공용 헬퍼(`raceDeleteRequests`+`assertSingleAudit` 등) 추출 여부를 결정할 것 — 또 유예하면 근거 없는 반복이 됨 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, testing | `beforeEach` fixture 의 `mockRepo.remove` mock 이 `remove()`→`delete()` 전환 이후 어떤 테스트에서도 참조되지 않는 죽은 fixture | `codebase/backend/src/modules/model-config/model-config.service.spec.ts:35` | 미사용 `remove` 키 제거 권장 (실행에는 무해) |
| 2 | requirement | 신규 e2e 주석("`isDefault: false` — 기본 설정이면 삭제가 default 스왑 경로를 함께 탄다")의 인과관계가 실제 구현에 존재하지 않음 — `remove()`는 `isDefault`/`saveWithDefaultSwap`을 전혀 참조하지 않고 DB 트리거도 없음 | `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts:57` | 기능 영향 없음. 다음 편집 시 주석을 "고정된 config 선택" 정도로 정정 권장 |
| 3 | security | `repo.delete({id, workspaceId})` 전환 후에도 워크스페이스 스코프가 DELETE 조건에 유지돼 테넌트 격리(IDOR 없음) 확인 | `model-config.service.ts` `remove()` | 조치 불요 |
| 4 | security, database | `affected === 0` 명시 비교 채택 — 드라이버가 `affected`를 `undefined`/`null`로 보고하는 경우를 삭제 실패로 오판하지 않도록 방어. 대조군 단위 테스트(`it.each([[undefined],[null]])`)로 커버 | `model-config.service.ts` `remove()`; `model-config.service.spec.ts:1129-1145` | 조치 불요 — 모범 사례 |
| 5 | security | 레이스 패자 응답이 일반 조회 실패와 동일한 404(`MODEL_CONFIG_NOT_FOUND`)로 통일돼 동시성 상태를 추론할 수 있는 정보 노출 없음 | `model-config.service.ts` `remove()`; 컨트롤러 `:170-175` | 조치 불요 |
| 6 | security | 감사 로그 중복 제거로 "누가 실제 삭제에 성공했는지" 추적 신뢰성 개선 | `model-config.service.ts` `remove()` | 조치 불요 |
| 7 | side_effect, api_contract | 동시 삭제 레이스 패자의 HTTP 응답이 204→404로 바뀜(의도된 수정). 새 에러 코드/스키마 도입 아니며 컨트롤러가 이미 `@ApiNotFoundResponse`로 문서화한 기존 코드 재사용 | `model-config.service.ts:422-425`; `model-config.controller.ts:161-176` | 조치 불요. 이 API를 폴링/재시도하며 "재전송 시 204"를 가정하는 외부 클라이언트가 있다면 인지 필요(코드상 확인된 바 없음) |
| 8 | side_effect | `notifyInvalidated` 호출 횟수 감소는 의도된 부수효과 — 유일한 구독자(`LlmService.clearClientCache`)가 멱등이라 무해함을 코드·plan 양쪽에서 확인 | `model-config.service.ts:427-430` | 조치 불요 |
| 9 | concurrency, database | `notifyInvalidated`/`recordAudit`이 삭제와 한 트랜잭션에 묶여 있지 않아 `recordAudit` 실패 시 감사 누락 가능 — 다만 `update()` 등 기존 코드에도 있던 사전 컨벤션이며 이번 diff가 새로 만든 위험 아님(회귀 아님) | `model-config.service.ts:422-437` | 조치 불요(기존 설계 범위) |
| 10 | maintainability | `remove()` 함수 내 주석 밀도가 실행 코드보다 훨씬 높음 — 다만 형제 PR 7건이 이미 채택한 동일 컨벤션의 연장 | `model-config.service.ts:401-421` | 9번째(WebAuthn) 처리 시 공통 근거를 `spec/conventions/`로 옮기는 방안 검토 (plan에 이미 예정) |
| 11 | documentation | `remove()`에 함수 상단 JSDoc 없음 — 같은 클래스의 다른 public 메서드는 JSDoc 보유, `remove()`는 인라인 주석만으로 동시성 계약 설명 | `model-config.service.ts` `async remove(...)` 선언부 | `@throws {NotFoundException} MODEL_CONFIG_NOT_FOUND` 한 줄 JSDoc 추가 권장(비차단) |
| 12 | documentation | 리뷰 도중 `model-config.service.ts` 1줄 미커밋 diff + `.bak` 파일을 일시 관측했으나 재확인 시점에 저장소가 이미 깨끗해짐(다른 병렬 리뷰 세션의 자체 원복으로 추정) | `codebase/backend/src/modules/model-config/model-config.service.ts` | 조치 불요 — 비-결함 관측 기록 |
| 13 | scope | 신규 `plan/in-progress/modelconfig-dup-delete.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 수정, `review/consistency/2026/09/21/16_16_35/*` 8개 파일은 모두 CLAUDE.md가 규정한 workflow 산출물(작업 plan, `--impl-prep` consistency-check 산출, 트래커 동기화)이며 무관한 범위 확장 없음 | 해당 각 경로 | 조치 불요 |
| 14 | testing, concurrency | 단위 테스트(진 쪽 404/감사·통지 스킵, `affected` undefined/null 대조군)와 e2e(실제 행 락 `SELECT...FOR UPDATE`로 인터리빙 강제)가 형제 패턴과 동일한 방법론으로 결함을 견고하게 재현·방어함. 뮤테이션(`affected===0`→`!affected`) 실측 결과 대조군 2건이 예측대로 RED | `model-config.service.spec.ts:1098-1146`; `model-config-delete-concurrency.e2e-spec.ts` | 조치 불요 — 모범 사례 |
| 15 | database, requirement, api_contract | `remove(entity)`→`delete(criteria)` 전환이 FK(`ON DELETE SET NULL`)·ORM 라이프사이클 훅(부재 확인)·인덱스(PK)·SQL 인젝션(파라미터 바인딩) 관점에서 동작 등가성이 실측으로 확인됨 | `model-config.service.ts`; 마이그레이션 `V090`/`V091` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음, 테넌트 격리·감사 정합성 개선 확인 |
| requirement | NONE | 형제 패턴과 spec 정합, e2e 주석 근거 오류 1건(INFO) |
| scope | NONE | 범위 이탈 없음, 모든 부수 파일이 workflow 산출물 |
| side_effect | NONE | 204→404 응답 변화는 의도된 수정, 캐시 통지 감소는 무해 |
| maintainability | LOW | e2e 테스트 형제 간 거의 전문 중복(WARNING, 기존 유예 결정) |
| testing | LOW | 죽은 `mockRepo.remove` fixture 1건(INFO), 그 외 커버리지 견고 |
| documentation | LOW | CHANGELOG 관례 누락 + 기존 CHANGELOG 반증된 서술 잔존(WARNING 2건) |
| database | LOW | `recordAudit`이 삭제 트랜잭션 밖 best-effort(기존 컨벤션, 회귀 아님) |
| concurrency | NONE | 새 동시성 결함 없음, 검증된 원자적 DELETE 패턴 |
| api_contract | NONE | breaking change 없음, 컨트롤러 계약 불변 |

## 발견 없는 에이전트

해당 없음 — 10개 reviewer 전원이 최소 INFO 이상을 기록했다(순수 "문제 없음"만 보고한 에이전트는 없으나, security/requirement/scope/side_effect/concurrency/api_contract 6개는 CRITICAL·WARNING 없이 NONE 위험도로 수렴).

## 권장 조치사항

1. `CHANGELOG.md`에 이번 PR(8번째, model-config) 항목을 형제 6건과 동일한 형식으로 추가하거나, 의도적으로 9번째와 묶어 기록할 계획이라면 plan 체크리스트에 그 사유를 명시한다.
2. 위 CHANGELOG 항목 추가 시, 7번째 형제 커밋이 남긴 "캐시 무효화 통지 중복까지" 예고 문장이 이번 PR의 실측으로 과장이었음이 드러났으므로 각주/정정 문구를 함께 남긴다.
3. `model-config.service.spec.ts:35`의 미사용 `mockRepo.remove` fixture를 정리한다(비차단, 인지 부하 감소용).
4. 9번째(WebAuthn) 동시성 e2e 착수 시, 지금까지 9개로 늘어난 거의-동일 e2e 파일들에 대해 공용 헬퍼 추출 여부를 실제로 결정한다 — 다시 유예할 경우 근거를 명시할 것.
5. (선택) `remove()`에 `@throws MODEL_CONFIG_NOT_FOUND` 한 줄 JSDoc을 추가해 다른 public 메서드와 문서 밀도를 맞춘다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract` (10명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (4명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(단건 DELETE 전환)와 관련성 낮음 |
  | architecture | router 판단상 이번 diff와 관련성 낮음 |
  | dependency | router 판단상 이번 diff와 관련성 낮음 |
  | user_guide_sync | router 판단상 이번 diff와 관련성 낮음 |
