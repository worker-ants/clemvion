# 정식 규약 준수 검토 — `spec-draft-nf-ob-07-redis-fail-open.md`

## 검토 대상

`plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` — `spec/5-system/_product-overview.md`
§NF-OB-07 메트릭 카탈로그에 `clemvion.redis.fail_open` 1행을 추가하고 `spec/data-flow/9-observability.md`
미러 문장을 갱신하는 spec draft.

## 발견사항

- **[WARNING]** `## Rationale` 섹션 부재 — 결정 근거가 별도 이름의 절에 있음
  - target 위치: 문서 전체. 마지막 본문 섹션이 `## 후속` → `## 체크리스트` 로 끝나고 `## Rationale`
    헤더가 없음. 실제 결정 근거는 `## 판단이 필요한 지점` (line 65-86, "`component` 를 지금
    `idempotency` 하나로 둘 것인가")에 있음.
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3번 — "**draft 작성**:
    `plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. **본문 끝에 `## Rationale` 로 결정
    근거 명시**." 및 §Spec 문서 구조 표(`## Rationale` = "결정 배경·근거·폐기된 대안"). 이는
    CLAUDE.md 가 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고" 로 위임한
    바로 그 규약이다.
  - 상세: `## 판단이 필요한 지점` 절은 내용상 Rationale 역할(왜 `component` 라벨을 `idempotency`
    단일 값으로 좁혔는가 — 실측 grep 근거 포함)을 정확히 수행하지만 헤더 이름이 규약과 다르다.
    이 저장소에는 `## Rationale` 헤더를 정규식(`^##\s+Rationale\b`, 대소문자·앵커 고정)으로
    기계적으로 소비하는 지점이 실재한다 — `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
    의 `extract_rationale_sections()` 가 `related_specs` 목록에서 이 헤더만 찾아 향후 관련 spec
    검토 시 "Rationale 발췌" 컨텍스트로 재사용한다. 현재는 `spec/**` 문서만 스캔 대상이라 이 plan
    문서 자체가 그 파이프라인에 걸리진 않지만, §5(spec 반영) 단계에서 이 절의 근거가 실제 spec
    (`_product-overview.md`/`9-observability.md`)의 `## Rationale` 로 옮겨지지 않으면 그 메커니즘의
    미래 소비 대상에서 누락된다.
  - 참고(완화 요인): 저장소의 기존 완료 `spec-draft-*.md` 53건을 실측하면 43건(81%)이 `## Rationale`
    을 쓰지만 10건(19%, 예: `spec-draft-frontend-layering.md`, `spec-draft-user-msg-early-surface.md`)
    은 없이도 완료 처리됐다 — 즉 이 규약은 build guard 로 강제되는 hard 규약이 아니라 SKILL.md 가
    명시한 soft 관례다. 등급을 CRITICAL 이 아닌 WARNING 으로 매긴 이유.
  - 제안: `## 판단이 필요한 지점` 을 `## Rationale` 로 이름을 바꾸거나, 그 내용을 문서 맨 끝에
    `## Rationale` 절로 옮긴다. §5 spec 반영 시 이 근거를 대상 spec 문서 자체의 `## Rationale` 에도
    동일하게 옮겨 적도록 체크리스트에 항목을 추가하면 더 안전하다.

## 준수 확인된 항목 (검토했으나 위반 없음)

- **파일 명명**: `spec-draft-nf-ob-07-redis-fail-open.md` 는 project-planner SKILL 의
  `plan/in-progress/spec-draft-<name>.md` 패턴을 정확히 따름.
- **frontmatter 스키마**: `worktree`/`started`/`owner` 필수 3필드 모두 존재
  ([`plan-lifecycle.md` §4](../../../../.claude/docs/plan-lifecycle.md)). `spec_impact` 는 리스트
  형식(Gate C 요건, `feedback_spec_impact_gate_c_list` 와 동일 기준) — bare string·빈 배열 아님.
  in-progress 단계의 `spec_impact` 선언은 Gate C 상 필수는 아니지만(완료 시점 필드) 금지도 아님.
- **frontmatter-evidence 제외 정합**: 대상 두 spec 파일 모두
  [`spec/conventions/spec-impl-evidence.md` §1](../../../../spec/conventions/spec-impl-evidence.md)
  의 명시적 제외에 해당 — `spec/5-system/_product-overview.md` 는 밑줄 prefix(`_*.md`)로 frontmatter
  의무 대상이 아니고, `spec/data-flow/9-observability.md` 는 영역 전체가 §1 에서 명시적으로 제외됨.
  실측(`head -5`)으로 두 파일 모두 현재 frontmatter 가 없음을 확인 — draft 도 frontmatter 추가를
  제안하지 않아 정합.
- **메트릭/라벨 명명**: 제안된 `clemvion.redis.fail_open` (Counter, 라벨 `component`/`reason`)
  은 §NF-OB-07 카탈로그 서두 규칙("OTel instrument 이름은 dot 표기 `clemvion.*`, 모든 라벨은
  bounded cardinality")과 기존 5행(`clemvion.execution.total` 등)의 명명 패턴을 그대로 따름.
  실제 구현(`codebase/backend/src/modules/metrics/business-metrics.service.ts` L38-46, L86-90,
  L134-139)과 대조해 instrument 이름·라벨 키·라벨 값 집합(`get_failed`/`set_failed`/
  `serialize_failed`/`entry_corrupt`/`payload_corrupt`)이 코드와 1:1 일치.
- **표 형식(라벨 인라인)**: 제안 행이 라벨 값을 표 셀에 인라인하는 방식은 기존 5행과 동일한
  패턴 — draft 본문이 스스로 인용한 과거 INFO 지적(산문 분리 시 두 관례 공존)을 선제적으로 회피.
  data-flow 미러 문장(`9-observability.md` L200-204)의 실측 내용도 draft 의 인용과 정확히 일치.
- **API 문서 규약(Swagger/DTO)**: 해당 없음 — 이번 변경은 REST endpoint/DTO 가 아닌 내부 OTel
  계측 카탈로그이므로 `spec/conventions/swagger.md` 적용 대상이 아님.
- **금지 항목**: `spec/conventions/**` 번들에서 이 변경과 충돌하는 명시적 금지 패턴 없음.

## 요약

target 은 실제 spec 문서(`_product-overview.md`/`9-observability.md`)가 아니라 그 변경을 준비하는
`spec-draft` plan 문서이며, 핵심 규약(frontmatter-evidence 제외 판정, Gate C `spec_impact` 리스트
형식, 메트릭/라벨 명명 패턴, 표 형식 관례)은 코드·기존 spec 실측 대조 결과 모두 정합했다. 유일한
편차는 project-planner SKILL 이 명시한 "본문 끝 `## Rationale`" 구조 관례를 따르지 않고 동등한
내용을 `## 판단이 필요한 지점` 이라는 다른 이름의 절에 둔 것인데, 이는 build guard 로 강제되는
hard 규약이 아니라(과거 draft 의 19%가 생략) SKILL.md 의 soft 권장이라 WARNING 으로 등급을 매겼다.

## 위험도

LOW
