# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**LOW** — spec 델타 0 코드 전용 PR. Critical 없음, WARNING 2건(둘 다 비차단·문서/네이밍 정리 성격).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | (없음) | | | | |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없어 인계 대상 자체가 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 신규 공용 헬퍼 `omit-undefined.ts`가 두 spec 어느 `code:` frontmatter 에도 등재되지 않음 — `2-trigger-list.md` 자신이 이미 명문화한 "헬퍼도 등재" 관행의 재발성 미이행 | `spec/2-navigation/1-workflow-list.md` frontmatter `code:` (line 4-9), `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (line 7-40) | `codebase/backend/src/common/utils/omit-undefined.ts`(+`.spec.ts`); `plan/in-progress/spec-draft-nullable-notation-followups.md` 기존 항목 (4)(5) | 같은 planner 턴에서 트래커에 항목 (6) 추가 — 두 spec `code:` 글로브 양쪽에 `common/utils/omit-undefined.ts` 등재 + 두 도메인 공유 사유 인라인 주석 |
| 2 | naming_collision | 신규 `omitUndefined` 와 기존 `omitKeys` 가 같은 파일에서 `omit*` 접두 공유 — shape 유사(부분집합 객체 반환)하나 목적 상반(입력 정제 vs 출력 redaction) | `codebase/backend/src/modules/triggers/triggers.service.ts:44,622` (`omitUndefined` import/사용), `:143` (`omitKeys` 정의) | 기존 모듈-로컬 `omitKeys` 함수 | (비강제 권고) 호출부 또는 JSDoc 에 두 헬퍼의 역할 차이(입력 undefined 필터 vs 출력 키 redaction) 한 줄 상호 참조 주석 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `GET /api/folders` 목록 응답이 bare array(`{ data: [...] }`, `pagination` 형제 없음)인데 `spec/5-system/2-api-convention.md §5.2` 의 비-페이징 예외가 이 엔드포인트를 명시하지 않음 — 이번 diff 의 산물 아님 | `spec/5-system/2-api-convention.md §5.2` | 별도 planner 턴에서 §5.2 에 "bare-array 비-페이징" 카테고리 명시 여부 판단 (조치 불요, 즉시 대응 없음) |
| 2 | rationale_continuity | `FolderDto.parentId` 선언 정정(optional+nullable → 상시존재+nullable)은 §5.4 를 뒤집은 것이 아니라 이미 문서화된 "어느 쪽에서도 틀렸다" 금지 조합을 뒤늦게 시정한 것 | `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts` (`parentId`) | 조치 불요 — 기록 목적 |
| 3 | convention_compliance | `omitUndefined` 도입 + `parentId` 선언 정정은 §5.4/`swagger.md` 요구를 오히려 더 엄격히 충족하는 방향 | `folders/dto/responses/folder-response.dto.ts`, `common/utils/omit-undefined.ts` | 조치 불요 |
| 4 | convention_compliance | 감사 액션/에러 코드 명명, `spec/conventions/*` cross-reference 앵커, frontmatter 라이프사이클, 3-섹션 구조 표본 검사 전부 정상 | `spec/2-navigation/*.md` (표본) | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 델타 0, 데이터모델·API계약·co-owner spec 어디와도 충돌 없음. INFO 1건(§5.2 문서화 공백, target 밖) |
| rationale_continuity | NONE | §5.4 이미 문서화된 원칙을 뒤늦게 집행한 것뿐 — Rationale 재도입·번복·우회 없음 |
| convention_compliance | NONE | §5.4/swagger 규약을 더 엄격히 충족하는 방향의 수정. 표본 대조(감사액션·에러코드·앵커·frontmatter·구조) 전부 정상 |
| plan_coherence | LOW | WARNING 1건 — 신규 공용 헬퍼가 두 spec `code:` frontmatter 어디에도 미등재 (관행 절반만 반영) |
| naming_collision | LOW | WARNING 1건 — `omitUndefined`/`omitKeys` 명칭·shape 유사, 목적 상반. 그 외 신규 식별자 전수 grep 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 planner 턴에서 항목 (6) 추가 — `common/utils/omit-undefined.ts`(+`.spec.ts`)를 `spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md` 양쪽 `code:` frontmatter 에 등재.
2. (선택, 비차단) `triggers.service.ts` 의 `omitUndefined` 호출부 또는 `omitKeys` JSDoc 에 두 헬퍼 역할 구분 상호 참조 주석 1줄 추가.
3. INFO 항목(§5.2 bare-array 비-페이징 문서화 공백 등)은 즉시 조치 불요 — 별도 planner 판단 대상으로만 기록.