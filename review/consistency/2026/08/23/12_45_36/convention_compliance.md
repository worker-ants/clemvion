# 정식 규약 준수 검토 (impl-done) — `spec/5-system/` (실제 diff: `spec/conventions/swagger.md` + DTO)

## 검토 방법

prompt 헤더가 지정한 target 은 `spec/5-system/` 이지만, `git diff origin/main...HEAD --stat` 실측 결과 실제 diff 는 다음 3곳뿐이고 `spec/5-system/**` 파일은 **하나도 포함되지 않는다**:

- `spec/conventions/swagger.md` (§3 DTO `description` 길이 규칙: 강제→지향, 보안·정책 캐비엇: 예외→지시 재프레이밍)
- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (`input` 필드에 `deprecated: true` + description 보강)
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` (신규 회귀 단언)
- (+ `plan/in-progress/swagger-decisions.md` 신설, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 3항목 종결, `review/code/**` 산출물)

따라서 이번 검토는 실제 diff 기준으로 보정해 두 방향을 확인했다: (a) 변경된 `execute-workflow.dto.ts` 가 갱신된 `spec/conventions/swagger.md` 의 DTO/데코레이터 패턴을 따르는가, (b) 선언된 target `spec/5-system/` 의 기존 문서들(swagger.md 를 활발히 참조하는 `2-api-convention.md`·`14-external-interaction-api.md` 등, 이번 세션에서 전문 번들됨)이 swagger.md 의 이번 개정으로 인해 stale 해지지 않았는가. 세션 내 `plan_coherence`/`cross_spec` checker 도 같은 scope 불일치를 독립적으로 관측했다(교차 확인됨).

## 발견사항

- **[INFO] 검토 scope 헤더(`target_path=spec/5-system/`)가 실제 diff 범위와 불일치**
  - target 위치: prompt `## Target 문서` 섹션 (`경로: spec/5-system/`)
  - 위반 규약: 직접적 `spec/conventions/**` 콘텐츠 위반은 아님 — 오케스트레이터의 라우팅/스코핑 절차 참고 사항
  - 상세: 이번 커밋 구간의 실질 변경은 `spec/conventions/swagger.md` 자체(정식 규약 문서)와 그 규약을 적용한 코드 1개 필드다. `spec/5-system/*.md` 는 이번 diff 에 전혀 등장하지 않아, "target 문서가 정식 규약을 따르는가"라는 본 체커의 질문이 문자 그대로는 공허(vacuous)하게 성립한다. 세션의 다른 두 checker(`plan_coherence`, `cross_spec`)도 동일 불일치를 각자 독립적으로 관측하고 실제 diff 기준으로 보정했다고 기록했다 — 오탐이 아니라 재현되는 스코핑 갭이다.
  - 제안: (검토 자체를 막을 사안 아님) 이번 라운드는 실제 diff 로 보정해 판단했으나, 반복되면 라우터의 target_path 산정 로직(3건 사용자 결정 → 대표 spec 영역 매핑)을 점검할 가치가 있다. 정정이 필요하면 project-planner/오케스트레이터 턴에서.

- **[INFO] `spec/5-system/` → `spec/conventions/swagger.md` 교차참조 무결성 — 이상 없음 (확인 완료, 조치 불요)**
  - target 위치: `spec/5-system/2-api-convention.md:145,147,183,437`, `spec/5-system/14-external-interaction-api.md:505,1108,1114,1116`
  - 위반 규약: 없음 — `spec/conventions/swagger.md §1-3, §1-4, §2-1, §2-5, §5, §6` 앵커 대상 검증
  - 상세: swagger.md 의 이번 개정은 `§3`(DTO 길이·보안 캐비엇) 절의 헤딩 텍스트·앵커를 바꿨다(`#3-보안정책-캐비엇-예외--...` → `#3-보안정책-캐비엇--...`). `spec/5-system/**` 전체를 grep 한 결과 이 §3 앵커를 인용하는 곳은 없고, 실제 인용은 모두 §1-3/§1-4/§2-1/§2-5/§5/§6(변경 없는 절)에 걸려 있어 깨진 링크가 없다. 새 §3 앵커(`#3-dto-길이는-왜-강제가-아닌가`, `#3-보안정책-캐비엇--왜-길이를-이유로-줄이지-않는가-그리고-왜-양방향인가`)도 GitHub 스타일 슬러그 규칙으로 직접 재계산해 본문 링크와 일치함을 확인했다(구 앵커 패턴의 이중 하이픈 규칙과 대조 검증). `10~40자` 옛 수치를 인용하는 `spec/5-system/**` 문서도 없다.
  - 제안: 없음 — 기록용.

- **[INFO] 변경된 DTO 필드는 갱신된 swagger.md §1/§3 패턴을 그대로 따른다 (확인 완료)**
  - target 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:41-68`
  - 위반 규약: 없음 — `spec/conventions/swagger.md §1-1`(JSDoc)·§1-3(Optional 필드 `@ApiPropertyOptional`)·§3(신설 "보안·정책 캐비엇 — 지시")
  - 상세: `input` 필드는 JSDoc + `@ApiPropertyOptional({ description, type, additionalProperties, deprecated })` 조합으로 §1-1/§1-3 형식을 따르고, description 은 "마스킹 마커 재제출 거부"를 설명하는 요청측 보안·정책 캐비엇에 해당해 §3 이 이번에 "지향 40자"의 예외가 아니라 **반드시 적어야 하는 지시**로 재정의한 것과 정확히 부합한다(40자 초과지만 위반 아님). `deprecated: true` 는 `@nestjs/swagger` 표준 필드로 오용이 없다.
  - 제안: 없음 — 기록용. (swagger.md 자신의 Rationale 이 "`deprecated` 패턴은 사례 1건이라 §1 로 아직 일반화하지 않는다"고 명시해, 이 필드가 §1 카탈로그에 별도 소절로 없는 것도 의도된 상태임을 스스로 밝히고 있다.)

## 미검출 (명시적으로 확인해 문제 없음을 확인한 항목)

- `spec/conventions/swagger.md` frontmatter(`code:` 글로브)는 이번 diff 로 변경되지 않았고, 여전히 패턴 구현 메커니즘(`common/swagger/**`, `nest-cli.json`, `production-guards.ts`, `main.ts`)만 가리킨다 — `spec-impl-evidence.md` 컨벤션은 "그 규약을 적용하는 모든 DTO"까지 `code:` 에 나열하도록 요구하지 않으므로, `execute-workflow.dto.ts` 미등재는 위반이 아니다.
- 동일 세션 앞선 `--spec` 모드 `convention_compliance` 결과(`review/consistency/2026/08/23/11_59_11/convention_compliance.md`)가 지적한 WARNING 1건(`deprecated` 패턴 §1 미편입)·INFO 2건은 이후 두 차례 `/ai-review` 라운드(`12_22_08`, `12_35_10`)를 거쳐 전부 반영·해소됐음을 최종본 대조로 재확인했다(§Rationale 에 "아직 일반화하지 않는다"는 판단 명문화 + 실측치 병존에 각주 추가). 신규 회귀는 없다.
- `codebase/backend/**` 전체에서 `deprecated: true` grep 결과 이번 1건이 유일 — swagger.md Rationale 의 "사례 하나뿐" 주장과 코드가 일치한다.

## 요약

이번 검토 대상으로 선언된 `spec/5-system/` 경로 자체는 이번 diff 에서 전혀 변경되지 않았고, 실제 변경은 정식 규약 문서인 `spec/conventions/swagger.md` (DTO `description` 길이: 강제→지향, 보안·정책 캐비엇: 예외→지시) 와 그 규약을 적용한 `ExecuteWorkflowDto.input` 필드 하나다. 이 scope 불일치는 세션 내 다른 checker(`plan_coherence`, `cross_spec`)도 독립적으로 관측한 재현 가능한 라우팅 갭이지만, 정식 규약 준수 판정 자체를 막지는 않는다. 실제 diff 기준으로 보정해 확인한 결과: (1) `spec/5-system/**` 가 swagger.md 를 인용하는 모든 지점(§1-3/§1-4/§2-1/§2-5/§5/§6)은 이번 개정 대상 밖이라 깨진 앵커·stale 인용이 없고, (2) 변경된 DTO 필드는 갱신된 §1/§3 패턴에 정확히 부합하며, (3) 앞선 `--spec` 라운드가 지적한 WARNING 은 두 차례 코드 리뷰를 거치며 전부 해소됐다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도
NONE
