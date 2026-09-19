# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. target 은 `spec/0-overview.md`(ORM 명칭 Prisma → TypeORM 정정) 와 `spec/1-data-model.md`(DB 기본값 두 곳 보강 + 가드 서술 정정)를 향한 순수 사실 정정 draft 이며, 5개 checker 전원이 CRITICAL/WARNING 급 실질 충돌을 발견하지 못했다. 유일한 WARNING 은 draft 안에 신규 삽입될 상호참조 링크 하나의 상대경로 깊이 오류(표기 결함)이다.

## 전체 위험도
**LOW** — 사실관계·계약·구조상 충돌은 0건. 유일한 실질 발견은 삽입 예정 링크 하나의 상대경로 깊이 오류(깨진 링크가 될 수 있음).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision (cross_spec·rationale_continuity 동일 지적, INFO→WARNING 상향 통합) | 변경 A(`spec/0-overview.md` Rationale trade-off 문단)에 신규 삽입되는 링크 `[데이터 모델 Rationale «code: 에 전용 e2e 가드 셋»](../../spec/1-data-model.md)` 가 `spec/conventions/**`·`spec/5-system/**` 전용 상대경로 깊이(`../../spec/…`)를 그대로 가져다 썼다. `spec/0-overview.md` 는 `spec/` 최상위 파일이라 `../..` 는 저장소 루트 밖으로 resolve 되어 깨진 링크가 된다 | `plan/in-progress/spec-draft-spec-fact-orm-defaults.md` §변경 A, trade-off 항목 | `spec/0-overview.md` 자체의 기존 관례(`:3`, `:15`, `:75`, `:338` 등 전부 `./1-data-model.md` 형) 및 실제 삽입 대상 문서 위치 | planner 가 `spec/0-overview.md` 에 반영할 때 링크를 `./1-data-model.md#code-에-전용-e2e-가드-셋-2026-09-19`(또는 상응 slug)로 교정. 앵커 없이 파일 전체를 가리키는 것도 가능하나 형제 파일 참조이므로 `../..` 는 항상 오류 |

> 근거: naming_collision 은 이 항목을 관점 6(파일 경로 컨벤션)에 해당한다고 보아 [WARNING] 으로 판정했다. cross_spec·rationale_continuity 는 동일 사실을 [INFO] 로 판정했으나, 하향 금지 원칙에 따라 통합 등급은 세 checker 중 최고 등급인 WARNING 을 유지한다.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | "정정 (YYYY-MM-DD)" 콜아웃 블록 표기가 `spec-impl-evidence.md` R-1·`review-citations.md` 에서 반복 사용되지만 이를 규정하는 전용 conventions 문서가 아직 없음 | `plan/in-progress/spec-draft-spec-fact-orm-defaults.md` §변경 A 끝 정정 블록 지시문 | 위반은 아님. 이 패턴이 세 번째로 반복되면 별도 conventions 화 고려 (지금은 차단 사유 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | ORM 명칭·DB 기본값 두 정정 모두 실측(마이그레이션 파일·엔티티 선언·e2e 가드 헤더 주석)과 정확히 일치. 유일한 발견은 신규 링크 상대경로 오류(INFO 판정) |
| rationale_continuity | NONE | 채택된 결정(Flyway, forward-only 등) 불변. 취소선 미보존은 CLAUDE.md 자기-반증형 소정정 예외(developer 전용) 적용 대상이 아니며, target 은 기존 "정정 콜아웃" 패턴을 올바르게 재사용. 동일 링크 이슈를 INFO 로 별도 지적 |
| convention_compliance | NONE | frontmatter 의무 대상 제외 목록에 두 파일 모두 해당(위반 없음). migrations append-only 저촉 없음. 표기 관례(`default=`…``, 정정 블록) 모두 기존 precedent 재사용 |
| plan_coherence | NONE | 두 정정 항목 모두 `spec-draft-nullable-notation-followups.md` 트래커(4866~4877행)가 명시 지시한 항목이며, 선행 plan(`entity-column-declaration-drift.md`, complete, 커밋 6f9c0f1c1)과 정합. 후속 항목 누락 없음 |
| naming_collision | LOW | 신규 식별자(요구사항 ID·엔티티·endpoint·이벤트·ENV var·파일) 도입 없음. 유일한 발견은 상대경로 깊이 오류(WARNING 판정) |

## 권장 조치사항
1. **(WARNING 해소)** `spec/0-overview.md` 에 반영 시 신규 삽입 링크 `../../spec/1-data-model.md` → `./1-data-model.md`(형제 파일 기준 상대경로)로 수정. 앵커는 `#code-에-전용-e2e-가드-셋-2026-09-19` 또는 실제 절 제목에 맞는 slug 사용.
2. draft 의 나머지 내용(ORM 명칭 정정, DB 기본값 두 곳 보강, entity-schema-declarations 가드 서술 구분)은 5개 checker 전원이 실측 대조로 확인했으므로 수정 없이 그대로 `spec/` 에 반영 가능.
3. (선택, 비차단) "정정 (YYYY-MM-DD)" 콜아웃 표기가 세 번째 문서에서도 쓰이게 되면 `spec/conventions/`에 정식 문서화를 검토.
