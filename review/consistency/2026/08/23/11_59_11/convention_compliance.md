# 정식 규약 준수 검토 — `plan/in-progress/swagger-decisions.md`

## 검토 방법
target 문서(`plan/in-progress/swagger-decisions.md`)의 결정 3건(①여분 키 400 유지 · ②`ExecuteWorkflowDto.input` deprecated · ③`swagger.md §3` 길이 규칙 비강제화)을 bundle 된 `spec/conventions/swagger.md` 전문과 대조했다. 이 worktree 에는 이미 구현이 반영돼 있어(`spec/conventions/swagger.md`, `execute-workflow.dto.ts`, `workflows-execute-body.spec.ts`, 트래커 문서의 uncommitted diff), target 이 서술한 결정이 실제로 어떤 산출물로 귀결됐는지까지 교차 확인해 판단 근거로 삼았다.

## 발견사항

- **[WARNING] `deprecated: true` 패턴이 swagger.md 의 DTO 패턴 카탈로그에 편입되지 않았다**
  - target 위치: `## ② \`deprecated\` 표시 — 리네임이 아니다` 섹션 전체
  - 위반 규약: `spec/conventions/swagger.md` §1 (DTO 패턴 카탈로그) — 특히 §1-5 `writeOnly`/`readOnly` 절과 §1-4 `oneOf`/`discriminator` 절이 세운 선례
  - 상세: swagger.md 는 "일관된 패턴 가이드"를 표방하며, 반복될 수 있는 결정(보안 민감 필드 → `writeOnly`, 응답 전용 파생 필드 → `readOnly`, 닫힌 union → `oneOf`+`getSchemaPath`)마다 §1 안에 전용 소절 + 코드 예시 + "의무" 문구를 둔다. 이번 결정(형제 DTO 간 동명이의 필드를 리네임 대신 `deprecated: true` 로 표시해 점진적으로 해소)도 같은 성격 — "같은 Swagger 표면에 이름은 같고 뜻이 다른 필드가 노출될 때 어떻게 하는가"라는, 다시 벌어질 수 있는 질문에 대한 일반 답이다. 그런데 실제 반영을 확인해보니(`spec/conventions/swagger.md` diff, `grep deprecated spec/conventions/swagger.md` 결과 0건) 이 패턴은 swagger.md 본문 어디에도 편입되지 않았고, 결정은 트래커(`spec-sync-external-interaction-api-gaps.md`)와 `execute-workflow.dto.ts` 의 JSDoc 안에만 남았다. target 문서 스스로 항목①에서 "열어 두면 다음 사람이 같은 조사를 반복한다"는 논리로 결정 기록의 SoT 편입을 강조하는데, 항목②에는 그 논리가 swagger.md 본문(패턴 카탈로그) 쪽으로는 적용되지 않았다.
  - 제안: `swagger.md` §1 에 짧은 소절(예: "§1-6 동명이의 back-compat 필드")을 추가해 "형제 DTO 가 같은 이름·다른 의미의 필드를 같은 Swagger 표면에 노출하게 되면 리네임 대신 `deprecated: true` + JSDoc 상호 참조로 해소한다"는 일반 규칙과 이번 사례를 예시로 남긴다. 별도 소절이 과하다고 판단하면, 최소한 그 판단(=일반화하지 않고 이 건 한정으로 남긴다는 의도)을 `## Rationale` 에 명시해 다음 리뷰가 "규약 누락"으로 재지적하지 않게 한다.

- **[INFO] 같은 문서 안에 요청 DTO 실측치가 두 개(다른 날짜·다른 총량) 병존**
  - target 위치: `## ③ 길이 규칙 — 실측이 "규칙 아님" 을 말한다` 표 (요청 DTO 116/335, 34%)
  - 위반 규약: 직접적 규약 위반은 아님 — `spec/conventions/swagger.md` §3 보안·정책 캐비엇 예외 절(2026-08-22 실측 기재분)과의 내부 정합성 이슈
  - 상세: target 의 실측(2026-08-23, "요청 DTO 116/335(34%)")이 그대로 `swagger.md` §Rationale `### §3 DTO 길이는 왜 강제가 아닌가` 에 반영됐다(확인함, `spec/conventions/swagger.md:423`). 그런데 같은 문서 §Rationale `### §3 보안·정책 캐비엇 예외` 절에는 하루 전(2026-08-22) 실측치 "요청 DTO 73개 파일의 description 333개 중 114개(34%)"가 그대로 남아 있다(`spec/conventions/swagger.md:463-464`). 두 수치는 파일 수(73 vs 74)·모집단(333 vs 335)·초과 건수(114 vs 116) 모두 미세하게 다르다 — 하루 사이 DTO 코드가 바뀐 결과로 보이며 개별 수치 자체는 각각 그 시점 기준으로 실측을 재현해도 정확했다(직접 재현: `요청 74개 파일 335개, 40자 초과 116개(34%)`, `응답 38개 파일 128개, 40자 초과 58개(45%)` — target 표와 일치). 다만 같은 SoT 문서에 "같은 모집단(요청 DTO description)"을 가리키는 서로 다른 숫자 두 벌이 각주 없이 나란히 남으면, 나중에 이 문서를 읽는 사람이 계산 실수로 오인하거나 어느 쪽이 최신인지 재확인해야 하는 비용이 생긴다.
  - 제안: item③ 작업 체크리스트에 "§3 보안·정책 캐비엇 예외 절의 2026-08-22 실측치에 1줄 각주(예: '전일 대비 DTO 파일 1개 증가로 총량 변동, 결론 불변')를 남긴다"를 추가하거나, 두 실측을 하나의 절로 합쳐 최신 수치로 통일한다.

- **[INFO] frontmatter `owner: developer` 가 planner 전속 작업(spec/conventions 편집)을 함께 묶는다**
  - target 위치: frontmatter `owner: developer` / 표의 "③ …" 행 "성격: planner"
  - 위반 규약: 직접적 spec/conventions/** 위반은 아님 — `CLAUDE.md` skill 표(project-planner 는 `spec/**` 쓰기, developer 는 `spec/` read-only)와의 정합성 참고 사항
  - 상세: target 문서 자신이 표에서 항목③의 "성격"을 명시적으로 planner 로 구분해 두었을 만큼 이 비대칭을 이미 인지하고 있다. 다만 frontmatter 의 단일 `owner` 필드는 이를 반영하지 않아, plan lifecycle 상 "누가 실제로 이 파일을 커밋했는가"를 frontmatter 만으로는 판별하기 어렵다. 이 항목은 spec/conventions/** 콘텐츠 규약이 아니라 CLAUDE.md 워크플로 라우팅 쪽 문제라 이 검토자의 1차 관할 밖이지만, 참고로 남긴다.
  - 제안: (선택) frontmatter 에 `owner: developer` 대신 혼합 표기(예: `owner: developer (③ planner turn)`) 또는 별도 필드로 항목별 owner 를 명시하면, 이후 이 plan 파일만 보고도 "spec/ 편집분은 어느 턴에서 나갔는가"를 추적하기 쉬워진다. 이미 표가 그 정보를 담고 있으므로 강제 사항은 아니다.

## 미검출(명시적으로 확인해 문제 없음을 확인한 항목)
- ① 결정 자체는 코드 무변경이라 swagger.md 대상 규약과 직접 충돌하지 않는다.
- ② `deprecated: true` 를 실제로 적용한 `execute-workflow.dto.ts` 는 §1 서두("JSDoc 우선, 부족한 경우 `@ApiProperty` 보강")·§3(보안·정책 캐비엇 예외 — 마스킹 마커 재제출 캐비엇 포함) 어느 쪽과도 충돌하지 않는다. 정책 캐비엇 문구에 형제 `parameterValues` 처럼 명시적 "SoT: …" 링크가 없다는 점은 확인했으나, 항목③이 DTO `description` 길이·형식을 "강제"에서 "지향"으로 낮춘 뒤에는 이 차이가 규약 위반으로 이어지지 않는다.
- ③ 개정된 §3 규칙 표·앵커 링크(`#3-dto-길이는-왜-강제가-아닌가` 등)는 실제 헤더 슬러그와 정확히 일치하며, `10~40자` 옛 규칙에 대한 타 spec 문서의 참조도 없어(grep 확인) cross-doc drift 는 없다.
- 순환 숫자(①②③) 표기, 결정 날짜 각주 스타일(`2026-08-23 사용자 결정` 등)은 저장소 전반의 기존 plan 문서 관행과 일치한다.

## 요약
target 문서는 세 결정 모두를 실제 반영된 `spec/conventions/swagger.md` 편집·코드·트래커 항목과 정확히 1:1 로 대응시켰고, §3 개정은 앵커·타 문서 참조까지 깨지지 않게 처리됐다. CRITICAL 급 규약 위반은 발견되지 않았다. 다만 ②의 `deprecated: true` 결정이 swagger.md 의 패턴 카탈로그(§1)로 승격되지 않아 "다음에 같은 상황이 오면 또 조사해야 하는" 갭이 남아 있고(WARNING), §3 개정 결과 같은 문서 안에 하루 차이의 요청 DTO 실측치 두 벌이 각주 없이 병존한다(INFO). 두 항목 모두 결정 자체를 뒤집을 사안이 아니라 문서 완결성 보강 제안이다.

## 위험도
LOW
