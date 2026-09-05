# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-notification-secret-storage.md`

## 발견사항

- **[WARNING]** draft 본문이 `## Rationale` 뒤에 새 섹션을 덧붙여 "Rationale 이 본문 끝" 규약을 어긴다
  - target 위치: L125 `## Rationale` ~ L145 (Rationale 본문) 다음, L147 구분선(`---`) 이후 L149 `## \`--spec\` 번들 관찰 (실행 전 실측)` 섹션이 파일 끝(L166)까지 이어짐
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3 ("draft 작성: … 본문 끝에 `## Rationale` 로 결정 근거 명시") 및 §절대 원칙 ("각 spec 문서는 3섹션 (Overview / 본문 / Rationale)"), 4 ("BLOCK: NO + Warning → `## Rationale` 에 노트 남기고 진행")
  - 상세: SKILL.md 는 draft 문서가 Overview(또는 사실관계/결정) → 본문 → `## Rationale` 순으로 끝나야 하고, 이전 라운드의 Warning 에 대한 대응 노트도 `## Rationale` **안에** 적도록 규정한다. 그런데 이 draft 는 Rationale 을 다 쓴 뒤 harness 번들링 결함을 관찰한 별도 최상위 섹션(`## --spec 번들 관찰`)을 추가해 문서 끝을 다시 늘렸다. 내용 자체(어떤 spec_impact 파일이 프롬프트에 실제로 실렸는지 실측)는 유익하지만, 배치가 "Rationale 이 마지막" 규약과 어긋난다.
  - 제안: 해당 관찰 내용을 `## Rationale` 절 안의 하위 항목(예: "### `--spec` 번들 관찰")으로 옮기거나, Rationale 앞(사실관계/결정 사이)으로 재배치해 Rationale 을 문서의 마지막 섹션으로 되돌린다. 혹은 이런 메타 관찰이 반복적으로 필요하다면 SKILL.md 자체에 "harness 관찰은 Rationale 뒤에 별도 섹션으로 붙일 수 있다"는 예외를 명시적으로 추가한다.

- **[WARNING]** 새로 인정한 구현 이탈(코드측 ref 화, 결정 (b))이 `pending_plans:` 로 연결되지 않는다
  - target 위치: `## ② 결정` 및 `## ③ 변경안 > spec/5-system/14-external-interaction-api.md §7.1` — "(b) 는 코드 변경이고 그것은 developer 트랙의 별도 PR 이다"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 정의("미구현 surface 를 책임지는 plan 경로") 및 R-5 근거("텔레그램 chat-channel 케이스에서 spec 가 plan 을 가리키지 않아 '어떤 plan 도 책임지지 않는 빈 약속' 으로 영구 누락")
  - 상세: `spec/5-system/14-external-interaction-api.md` 는 `status: partial` 이고 이미 `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` 를 갖고 있으나, 그 plan 을 확인한 결과(`grep`) `notification_secret_v2` 를 ref 화해야 한다는 이번 결정 (b) 를 추적하는 항목이 없다(관련 언급은 §8.2 HMAC 화이트리스트 정정이라는 **다른** 이미 종결된 항목뿐). draft 는 "지금 문서가 거짓인 것은 즉시 고친다"면서 §7.1 을 "설계는 ref, 현재 구현은 평문 — 알려진 이탈" 로 정정하는 데는 신경 쓰지만, 그 이탈을 실제로 해소할 developer 트랙 작업을 **어느 plan 이 책임지는지는 등록하지 않는다.** 이는 spec-impl-evidence.md 가 막으려 했던 바로 그 실패 모드("이탈은 문서화됐지만 책임지는 plan 이 없어 영구 방치")를 다시 만들 위험이 있다.
  - 제안: §③ 변경안에 "새 developer-track plan(`plan/in-progress/<name>.md`)을 만들어 `notification_secret_v2` ref 화 작업을 등록하고, `14-external-interaction-api.md` 의 `pending_plans:` 에 추가한다" 항목을 넣거나, 기존 `spec-sync-external-interaction-api-gaps.md` 에 이 이탈 해소 체크박스를 신설해 같은 pending_plans 참조로 흡수시킨다.

- **[INFO]** 실측 인용이 편집 대상 파일의 줄 번호(`L922`)에 고정돼 있어 draft 실행 시점에 stale 해질 수 있다
  - target 위치: `## ③ 변경안 > spec/5-system/14-external-interaction-api.md §7.1` "L922 의 `notification_secret_v2` 절을 사실로 정정"
  - 위반 규약: 명시적 `spec/conventions/**` 항목은 아니나, `spec/conventions/review-citations.md` 가 세운 "인용은 스스로 해소돼야 한다"는 원칙과 같은 논리 — 이 draft 자신이 그 문서(§7.1)를 수정할 예정이므로, 적용 시점에는 위쪽 편집으로 줄 번호가 이동해 있을 수 있다.
  - 상세: 현재 L922 인용은 실측 시점(본 검토)에는 정확하다(직접 확인함). 그러나 같은 draft 가 제안하는 "이탈 blockquote 신설"이 §7.1 앞부분에 몇 줄을 더 삽입하면, 실제 적용 커밋에서는 그 줄 번호가 더 이상 L922 가 아닐 수 있다.
  - 제안: 줄 번호 대신 앵커 문구("`notification_secret_v2` 컬럼도 동일하게 ref 만 보관" 문장)로 대상을 특정하면 적용 시점 drift 에 영향받지 않는다.

## 요약

target 문서(`spec-draft-notification-secret-storage.md`)의 frontmatter(worktree/started/owner/spec_impact 리스트)는 규약을 정확히 지키고, `spec_impact` 4개 파일이 §③ 변경안과 1:1 대응하는 등 핵심 골격은 견고하다. `secret-store.md §1` 예외 목록을 건드리지 않기로 한 결정, `2-api-convention.md` 의 `code:` 검증자 짝 등재 제안(swagger.md 실측과 대조해 확인 — 실제로 `swagger-dto-contract*.ts` 가 빠져 있음), `4-integration.md` 의 포인터화 제안은 모두 기존 규약·실제 코드 상태와 정합했다. 다만 (1) draft 자체의 문서 구조가 project-planner SKILL.md 가 규정한 "Rationale 이 본문의 마지막 섹션" 원칙을 어기고, (2) 이번에 새로 인정한 구현 이탈에 대한 developer 트랙 후속 작업이 `pending_plans:` 로 연결되지 않아 spec-impl-evidence.md 의 핵심 방지 목적(책임 plan 없는 영구 누락)이 재현될 소지가 있다. 둘 다 빌드 가드를 직접 깨뜨리지는 않는 WARNING 수준이며, spec 반영 전에 보완하는 편이 안전하다.

## 위험도

LOW
