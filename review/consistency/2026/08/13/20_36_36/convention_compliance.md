# 정식 규약 준수 검토 — convention_compliance

검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)

## 검토 범위 요약

이번 diff (`origin/main...HEAD`) 는 `spec/5-system/**.md` 문서를 **전혀 변경하지 않는다**. 변경 파일 5개는 전부 백엔드 구현 코드다.

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규) — TypeORM `UPDATE`/`DELETE` raw query 가 `[rows, rowCount]` 튜플을 돌려주는 shape 문제를 흡수하는 헬퍼
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — admission·status-update 두 지점에서 헬퍼 적용
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 실측 shape 회귀 테스트 추가
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — CAS 락 2곳 + document reset 2곳에서 헬퍼 적용

새 API endpoint·DTO·이벤트 페이로드·에러 코드 문자열·Swagger 데코레이터는 도입되지 않았다 (`KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS` 는 기존 문자열 그대로, 변경 없음). 아래 5개 관점 각각에 대해 확인한 결과다.

## 검토 관점별 확인

1. **명명 규약** — 신규 파일 `update-returning-rows.ts`/`.spec.ts` 는 kebab-case 로, 같은 디렉토리(`codebase/backend/src/common/utils/`)의 동일 도메인 선례 `assert-row-array.ts`(raw SQL row 검증 헬퍼)와 접미사 관례(`.util.ts` 미사용)까지 일치한다. 함수명 `updateReturningRows` 는 camelCase 로 기존 `assertRowArray` 와 톤이 같다. `spec/conventions/**` 에는 backend 유틸 파일 명명을 별도로 규정한 문서가 없으므로 대조할 정식 규약이 없고, 기존 코드베이스 선례와도 어긋나지 않는다.
2. **출력 포맷 규약** — 변경분은 서비스 내부 DB 결과 소비 로직만 건드리며, HTTP 응답 envelope·WebSocket 이벤트 페이로드·에러 코드 문자열 자체는 무변경이다 (`error-codes.md`/`2-api-convention.md §5.3`/`3-error-handling.md §2.1` 대상 표면 아님).
3. **문서 구조 규약** — `spec/5-system/**.md` 어떤 파일도 diff 에 없다. Overview/본문/Rationale 3섹션 요건이 적용될 신규·수정 spec 문서가 없다.
4. **API 문서 규약** — 컨트롤러·DTO·`@Api*` 데코레이터 변경 없음. `spec/conventions/swagger.md` 대상 표면 아님.
5. **금지 항목** — `spec/conventions/` 전수 조사(`grep -rn "RETURNING\|assertRowArray\|updateReturningRows"`) 결과 이 패턴을 다루는 기존 규약이 없고, 따라서 명시적으로 금지된 패턴을 답습하는 것도 없다. `assert-row-array.ts`(`assertRowArray`)의 잔존 사용처(`execution-engine.service.ts:8220`)는 이번 diff 로 orphan import 가 되지 않았음을 확인했다 (다른 지점에서 계속 사용 중).

### `spec/conventions/spec-impl-evidence.md` 관점 (frontmatter evidence)

새 파일은 `codebase/backend/src/common/utils/` 아래에 있고, `execution-engine`/`knowledge-base` 관련 spec(`spec/5-system/4-execution-engine.md` 등, 이번 검토에선 컨텍스트 예산 초과로 본문 절단)의 `code:` 글로브는 이미 `modules/execution-engine/**`·`modules/knowledge-base/**` 등 기존 매치를 보유한 것으로 추정된다(≥1 매치 요건은 diff 이전부터 충족). 신규 공용 유틸이 그 글로브 밖에 있어도 §4 가드(`spec-code-paths.test.ts`)의 "≥1 매치" 요건에는 영향 없다 — 위반 아님.

## 발견사항

없음. 이번 diff 범위에서 `spec/conventions/**` 위반으로 분류할 항목을 찾지 못했다.

### 참고 (비-위반, 정보성)

- **[INFO] 반복되는 버그 클래스의 규약화 여지**
  - target 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` 상단 JSDoc
  - 위반 규약: 해당 없음 (기존 규약을 어긴 것이 아니라, 규약 부재 지점을 짚는 참고)
  - 상세: 코드 주석 자체가 "이 저장소는 이미 두 번 이 결함을 겪었다"(`agent-memory-admin`, `stuck-document-recovery`)고 명시하는데, 이번이 사실상 세 번째 발생(admission 판정 2곳 + KB CAS 락 2곳 + document reset 2곳)이다. `spec/conventions/`에는 raw TypeORM `UPDATE`/`DELETE` 결과 소비 패턴을 규율하는 문서가 아직 없다 — `migrations.md`는 마이그레이션 파일 운영만, `node-output.md`의 `rowCount` 언급은 워크플로 노드 출력 표시용으로 무관하다.
  - 제안: 위반은 아니므로 이번 PR을 막을 사유는 아니다. 다만 동일 결함이 네 번째로 재발하는 것을 막으려면, `spec/conventions/`에 (예: 기존 어느 문서에 절 추가, 또는 신규 문서로) "raw query 로 UPDATE/DELETE RETURNING 을 소비하는 모든 신규 지점은 `updateReturningRows` 헬퍼를 거친다"는 규칙을 정식 규약으로 승격하는 것을 `project-planner`에게 후속 검토로 제안할 만하다. 코드 내 회귀 테스트(`update-returning-rows.spec.ts`의 `EXPECTED` grep 카운트)가 이미 그 역할을 부분적으로 수행하고 있으나, 코드 테스트만으로는 "왜 이것이 정식 규약인가"의 SoT가 spec 계층에 없다.

## 요약

이번 diff는 spec/5-system/**.md 문서를 전혀 수정하지 않는 순수 백엔드 버그 수정(TypeORM UPDATE/DELETE RETURNING 튜플 shape 오인식 교정)이며, 신규 API 표면·에러 코드·이벤트 페이로드·Swagger 데코레이터·문서 구조 변경이 없어 `spec/conventions/**`가 규정하는 다섯 관점(명명·출력 포맷·문서 구조·API 문서·금지 항목) 중 어느 것도 위반하지 않는다. 신규 유틸 파일의 명명은 같은 디렉토리의 기존 선례(`assert-row-array.ts`)와 일관되고, 잔존 `assertRowArray` import 도 다른 호출부에서 여전히 쓰이고 있어 orphan 이 아니다. 유일한 언급사항은 위반이 아닌 정보성 제안 — 같은 결함 클래스가 이미 세 번째로 재발한 만큼 관련 규칙을 `spec/conventions/`에 정식 승격하는 것을 후속 planner 작업으로 고려할 만하다는 점이다.

## 위험도

NONE
