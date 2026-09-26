# Rationale 연속성 검토 — `spec-draft-review-citations-class-jsdoc`

## 발견사항

- **[INFO]** 새 Rationale 절이 스스로 "이번 결정에서 처음 나온 선택지" 라고 단언한다 — 근거 확인됨, 다만 명시해 둘 가치
  - target 위치: `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` `## Rationale` 추가안, "그래서 클래스 JSDoc 에 대해 두 방향을 검토했다(이번 결정에서 처음 나온 선택지다)" 문장
  - 과거 결정 출처: `spec/conventions/review-citations.md` `## Rationale` 의 "DTO JSDoc 행이 왜 필요한가" 콜아웃 (2026-09-05 등재) — 리뷰 인용/공개 `description` 충돌만 다루고 필드·클래스 구분은 다루지 않음
  - 상세: `spec/conventions/review-citations.md`·`swagger.md` 전체와 번들에 포함된 관련 spec Rationale 을 훑었으나 "응답 DTO 클래스 JSDoc 을 인용 허용 대상으로 볼지" 를 과거에 검토·기각한 흔적은 없다. 따라서 이 단언은 반증되지 않았고, (A)/(B) 두 선택지 도입 자체는 새로운 결정이 맞다. 다만 "처음 나온 선택지다" 라는 전칭 주장은 `git log -S` 로 재확인하지 않은 서술이라 — 만약 이 진술이 결과적으로 틀리면 이 결정문이 "선례 없음" 을 근거로 쓰는 것 자체가 무너진다.
  - 제안: (조치는 불필요 수준이나 강화하려면) 커밋 전에 `git log -S '클래스' -- spec/conventions/review-citations.md spec/conventions/swagger.md` 정도로 한 번 더 확인해 문구에 "grep/log 확인 완료" 를 덧붙이면 다음 검토자가 재확인할 필요가 없어진다.

- **[INFO]** §3 표 "대상 아님" 결론 자체는 유지되고 근거만 갈리는 구조 — 번복이 아니라 정정에 해당함을 명시하면 더 명확
  - target 위치: 변경안 §3 표의 두 번째 행 "응답 DTO 클래스의 `/** */` JSDoc | 대상 아님 — 필드와 같이 쓰지 않는다"
  - 과거 결정 출처: 기존 §3 표 "DTO·컨트롤러의 `/** */` JSDoc | 대상 아님"
  - 상세: 결론(리뷰 인용을 JSDoc `/** */` 에 쓰지 않는다)은 필드·클래스 모두 그대로 유지되고, 바뀌는 것은 근거 문장("공개 OpenAPI description 으로 나간다" → 클래스는 "지금은 안 나가지만 그래도 같은 규칙을 둔다")뿐이다. 이는 CLAUDE.md 가 정의하는 "결정의 무근거 번복"(과거 결정을 뒤집으면서 Rationale 미기재)에 해당하지 않는다 — 결론 유지 + 근거 정정 + 새 Rationale 동시 기재로, 이 저장소가 이미 여러 차례 쓴 패턴(예: 같은 문서의 "Prisma→TypeORM 정정", `swagger.md`의 "§3 DTO 길이는 왜 강제가 아닌가")과 형태가 같다.
  - 제안: 변경 불필요. 참고용 기록.

- **[INFO]** 기각한 대안 (A) 의 근거가 이 저장소의 기존 원칙과 일치함 — 교차 확인 결과만 기록
  - target 위치: 추가 Rationale 절의 "(A) 클래스 JSDoc 을 `//` 와 같게 본다 … 가드를 느슨하게 한다. 쓰는 사람이 «이 `/** */` 는 나가는가» 를 플러그인 구현으로 판정해야 한다" 부분
  - 과거 결정 출처: `spec/conventions/swagger.md` `## Rationale` "§1-6 numeric wire 타입 — 가드와 규약의 책임 분리" ("정적으로 판별 가능한 갈래는 가드, 사람이 판단해야 하는 갈래는 규약이 맡는다" 는 분업 원칙)
  - 상세: (A) 를 기각하면서 든 이유("쓰는 사람이 플러그인 구현을 알아야 판정 가능")는 이 저장소가 이미 다른 자리에서 반복 채택한 원칙 — "구현 세부사항에 의존하는 판정을 규칙 표면으로 끌어들이지 않는다" — 과 같은 방향이다. 상충이 아니라 보강.
  - 제안: 변경 불필요.

검증한 사실관계 (Rationale 연속성 판정의 전제로 확인):
- 가드(`dto-jsdoc-citation-guard.ts`)는 `ts.isClassDeclaration` · `ts.isPropertyDeclaration` 을 모두 훑어 클래스·필드 JSDoc 인용을 함께 센다 — draft 의 "가드는 이미 클래스·프로퍼티 JSDoc 을 함께 센다" 서술과 일치.
- `EXPECTED_DTO_JSDOC_CITATIONS` 는 실제로 `ScheduleTriggerWorkflowRefDto` · `TriggerWorkflowRefDto` 두 항목만 동결하고 있다 — draft 의 구현 위임 범위와 일치.
- 선행 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 항목(1277행)이 남긴 질문("클래스 JSDoc 도 대상인가를 §3 표가 명시하지 않는다")과 이 draft 의 착수 배경이 정확히 대응한다 — 트래커 항목 자체도 이 draft 가 다루는 것과 다른 결론을 미리 내린 바 없다(순수 open question).

## 요약

Rationale 연속성 관점에서 이 draft 는 문제를 일으키지 않는다. §3 표의 "대상 아님" 결론은 필드·클래스 양쪽에서 그대로 유지되며, 바뀌는 것은 부정확했던 근거 문장뿐이다 — 그리고 draft 는 그 정정에 대해 (A)/(B) 두 대안을 명시적으로 비교하고 기각 사유를 적은 새 `## Rationale` 절을 함께 작성했다(CLAUDE.md·이 checker 가 요구하는 "결정 번복 시 새 Rationale 동반" 요건 충족). 기각한 대안(A: 클래스 JSDoc 인용 허용 + 가드 완화)은 저장소가 다른 곳(`swagger.md` §1-6)에서 이미 쓴 "정적 판별 가능 갈래는 가드, 판단이 필요한 갈래는 규약" 분업 원칙과 같은 방향이라 상충이 아니라 보강이다. 과거 Rationale(§3 "DTO JSDoc 행이 왜 필요한가" 콜아웃)에서 명시적으로 거부된 대안을 재도입하는 지점도, 합의된 설계 원칙을 우회하는 지점도 찾지 못했다. 실측(가드 소스 코드 직접 확인)도 draft 의 사실 주장과 일치한다.

## 위험도

NONE
