# Rationale 연속성 검토 — `spec/conventions/` (impl-prep)

## 스코프 판단

번들된 `spec/conventions/**` 자체(감사 액션 명명 규약·Cafe24 카탈로그 등)에는 이번 착수 대상
(`plan/in-progress/guide-identifier-existence.md` — `guide-error-code-existence` 가드를
환경변수 축으로 확장 + "방어적 허용목록" 도입)과 충돌하는 `## Rationale` 항목이 없다.
`spec/conventions/error-codes.md §Rationale` 은 명명 규율(semantic naming·rename vs 신설·
예외 레지스트리·retirement 기준)만 다루고, 이 가드의 판정 축·허용목록 여부는 그 문서의
소유 범위 밖이다(그 경계 자체가 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3263`
의 `--impl-prep` 판정으로 명문화돼 있음: "`error-codes.md` 에는 적지 않는다 — 그 문서가
소유 범위를 명명원칙/rename/historical-artifact 로 스스로 못박았다"). `user-guide-evidence.md`
는 `<ImplAnchor>` 가드 가족의 SoT 이지만 본문·Rationale(R-1~R-5) 어디에도 `guide-error-code-existence`
가드가 등재돼 있지 않다 — 이 사실 자체가 아래 발견의 핵심이다.

## 발견사항

- **[WARNING]** "허용목록 없음" 설계 원칙의 번복이 spec Rationale 이 아니라 plan/코드 주석에만 산다
  - target 위치: `plan/in-progress/guide-identifier-existence.md` §C ("`#1330` 의 '허용목록
    없음' 은 이번 축에서 유지할 수 없다" + 방어적 허용목록 4강제 표), 체크리스트 항목
    "`#1330` 가드 주석의 '허용목록 없음' 서술 정정"
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D`("전수 열거(82종) + 허용목록도
    검토했고 기각했다 … backend-only 기준집합이 옳은 것은 대상이 에러 코드일 때뿐이다")와
    `§J`("체커 권고 … 허용목록이 필요해진다. 그건 이 가드가 처음부터 피한 설계다"), 그리고
    `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` 상단 JSDoc
    ("탈출구(허용목록)를 미리 파 두면 '…' 로 오늘의 결함이 다시 들어온다"). 이 세 지점이 이
    가드의 "허용목록 없음"을 반복해 명시적으로 확립한 설계 원칙이다. 다만 **이 원칙은
    `spec/conventions/**` 어디에도 등재된 적이 없다** — `user-guide-evidence.md §2.1` 관계표에
    두 가드(`guide-error-code-existence.test.ts` 포함)가 아직 빠져 있다는 사실이 별도 열린
    planner 백로그 항목으로 이미 지적돼 있다
    (`plan/in-progress/spec-draft-nullable-notation-followups.md:3243-3264`).
  - 상세: 새 plan 은 이 원칙을 뒤집으면서(§B 실측 + §C 4강제) **plan 문서 내부에는** 근거를
    갖추고 있어 "무근거 번복"은 아니다. 그러나 프로젝트 SoT 규약(`CLAUDE.md` "결정의 배경·근거
    → 해당 spec 문서 끝의 `## Rationale`")에 따르면 이 근거는 `spec/conventions/user-guide-evidence.md`
    에 반영돼야 하는데, 체크리스트는 **코드 JSDoc 정정만** 겨냥하고 spec Rationale 갱신을
    포함하지 않는다. 결과적으로 (a) 이 가드의 존재·설계축 자체가 아직 spec 밖에 있는 상태에서
    (b) 그 설계의 핵심 불변식(허용목록 없음)이 뒤집히는데, 두 사실 다 spec 에 기록되지 않는다.
    다음에 이 가드를 보는 사람은 spec 만 봐서는 "왜 허용목록이 있는지", "왜 원래 없었는지"
    를 재구성할 수 없고, 코드 JSDoc 만 정정되면 §D/§J 가 남긴 "탈출구가 결함을 되부른다"는
    경고가 다시 흐려질 위험이 있다(이 계열 plan 이 §J 에서 스스로 지적한 "등재를 두 번 좁게
    썼다"는 패턴과 같은 형태 — 이번엔 "등재 자체를 안 한다"는 세 번째 변형).
  - 제안: 구현 완료 시 `spec/conventions/user-guide-evidence.md` 에 (1) 이미 열려 있는
    §2.1 관계표 미등재(두 가드 + frontmatter `code:`) 항목과 (2) 이번 plan 이 신설하는 env
    축·"방어적 허용목록"을 **한 턴에 묶어** Rationale 로 등재한다. 새 Rationale 에는 최소
    두 가지를 명시할 것 — ① 왜 이번 축은 "허용목록 없음" 원칙을 유지할 수 없었는가(§B 실측),
    ② 왜 §D/§J 의 기각 근거(자기증명 오염 위험)가 이번엔 적용되지 않는가(env 선언처가
    frontend 소스와 달리 §B 에서 실측한 대로 자기증명 위험이 없음). 두 planner 방문으로
    쪼개면 §2.1 표가 두 번 미완결 상태로 갱신될 위험이 있다(과거 이 가드 계열이 3회 반복한
    "좁게 등재" 패턴 — `guide-error-code-truth.md §J` 참조).

- **[INFO]** 넓힌 판정 기준집합(source ∪ env 선언처) 자체는 §D 의 기각 근거와 직접 충돌하지 않음 — 근거만 spec 화 필요
  - target 위치: `plan/in-progress/guide-identifier-existence.md §B/§C`
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D` ("frontend 를 기준집합에
    넣으면 가이드가 인용한 이름이 프런트 라벨 맵으로 자기를 증명한다")
  - 상세: §D 가 기각한 것은 "frontend 소스를 기준집합에 포함"이며, 새 plan 이 추가하는 것은
    "env 선언처(`.env.example`·compose)"로 서로 다른 자원이다. §B 는 env 전용 21종이 전부
    인프라 이름이고 에러코드꼴이 0건임을 실측해 자기증명 오염 위험이 없음을 보였으므로
    형식적으로 §D 재도입은 아니다. 다만 이 구분(어떤 확장은 안전하고 어떤 확장은 위험한지)의
    실측 근거가 plan 문서에만 있어, 위 WARNING 과 동일한 이유로 spec Rationale 부재 상태다.
  - 제안: 위 WARNING 제안에 포함해 함께 기록 — 별도 조치 불요, 한 Rationale 절에 병기.

## 요약

번들된 `spec/conventions/**` 본문에는 이번 착수(`guide-identifier-existence`)와 직접
충돌하는 기존 `## Rationale` 조항이 없다 — 관련성이 높은 문서(`error-codes.md`,
`user-guide-evidence.md`)의 Rationale 은 이 가드의 판정 축·허용목록 여부를 애초에 다루지
않는다. 그러나 그 이유 자체가 문제다: 이 가드("허용목록 없음")의 설계 원칙은 `spec/`
어디에도 승격되지 않은 채 plan 이력(`guide-error-code-truth.md`)과 코드 JSDoc 에만 살아
있고, 그 원칙을 이번 plan 이 (근거를 갖추고) 뒤집는데도 spec Rationale 갱신이 체크리스트에
없다. Rationale 연속성 메커니즘이 원래 지키려는 것(다음 사람이 spec 만 보고 과거 결정과
그 번복 이유를 재구성할 수 있어야 함)이 이 가드 계열에서는 애초에 성립하지 않는 상태이며,
이번 변경이 그 공백을 넓힌다.

## 위험도

MEDIUM
