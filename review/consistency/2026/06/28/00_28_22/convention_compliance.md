# Convention Compliance Review — `spec/conventions/error-codes.md`

검토 모드: spec draft (--spec)  
대상 파일: `/Volumes/project/private/clemvion/spec/conventions/error-codes.md`  
검토 일시: 2026-06-28

---

## 발견사항

### **[WARNING]** §3 신규 행이 같은 모듈의 다른 lowercase 코드를 누락 등록

- **target 위치**: `spec/conventions/error-codes.md` §3 Historical-artifact 예외 레지스트리 신규 행 (workspace_type_mismatch · already_a_member · invitation_already_pending · invitation_already_accepted)
- **위반 규약**: `spec/conventions/error-codes.md` §3 preamble — "원칙(§1)을 따르지 않는 기존 코드를 명시적으로 등록한다." (§1 UPPER_SNAKE_CASE 위반 코드는 §3 에 전부 등재해야 명시적 예외 레지스트리의 completeness 를 보장한다)
- **상세**: 신규 §3 행이 `workspace-invitations.service.ts` 의 4개 lowercase 코드를 등록하면서 행 본문에 "같은 모듈의 다른 lowercase 코드(`workspace_not_found` 등)와 mixed-case 를 유발한다"고 스스로 언급한다. 그러나 같은 모듈이 발행하는 `workspace_not_found`(3회), `user_not_found`(1회), `admin_required`(1회) 는 §3 에 등재되지 않았다. 이 코드들도 §1 UPPER_SNAKE_CASE 위반이며 클라이언트(또는 모듈 일관성) 이유로 유지되는 active 코드다. §3 의 "명시적 등록" 원칙이 불완전하게 적용된 상태이며, 미등재 코드가 future review 에서 "등록 없이 사용된 §1 위반"으로 오해될 수 있다.
- **제안**: `workspace_not_found` · `user_not_found` · `admin_required` 를 신규 §3 행 또는 별도 행에 추가 등록한다. 행 분류 방식은 기존 초대 토큰 코드 그룹처럼 ` · ` 구분자로 같은 셀에 합산하거나, 별도 행으로 "초대 발급·재발송 API 한정" 주석과 함께 기술한다.

---

### **[WARNING]** §3 에 새로운 예외 근거 유형이 추가됐으나 Rationale 섹션에 대응 bullet 없음

- **target 위치**: `spec/conventions/error-codes.md` §3 신규 행 "이름이 부정확한 이유" 셀 + `## Rationale` 섹션
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 에 기술한다
- **상세**: 기존 §3 예외들의 유지 근거는 §2 breaking-change 기준("클라이언트가 코드 값으로 분기")이었다. 신규 행은 이와 다른 근거("모듈 내 다른 lowercase 코드와 mixed-case 유발 — 모듈 일관성 보존, 호환 이득 0")로 유지를 결정한다. 이는 §3 가 허용하는 예외 근거를 사실상 확장하는 결정이지만, `## Rationale` 에 이 확장을 설명하는 bullet 이 없다. 기존 `## Rationale` 에는 §5 진입 기준 bullet 이 추가됐는데(현재 파일 기준), §3 예외 근거 확장에 대한 대응 bullet 은 빠져 있다.
- **제안**: `## Rationale` 에 "왜 §3 예외 근거가 §2(client-branch breaking) 이외로 확장될 수 있는가" 를 설명하는 bullet 을 추가한다. 예: "모듈 내 일관성 보존도 §3 예외 근거가 될 수 있다 — 동일 모듈이 혼용 케이스를 발행하면 코드베이스 내 표기 혼선이 발생하며, 클라이언트 분기가 없어도 rename 의 이득(0)이 비용(모듈 전체 정규화)을 정당화하지 않는 경우 lowercase 유지를 허용한다."

---

### **[INFO]** Overview 의 swagger 참조가 anchor 없는 텍스트 참조 (`§2-4`)

- **target 위치**: `spec/conventions/error-codes.md` `## Overview` — `swagger 데코레이터 패턴은 [\`swagger.md §2-4\`](./swagger.md)` (행 18)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` `spec-link-integrity.test.ts` — in-repo 링크는 대상 파일 + anchor heading slug 실존을 강제
- **상세**: 링크 대상은 `./swagger.md` 파일 자체이고 anchor(`#2-4-...`)가 없다. `spec-link-integrity.test.ts` 는 anchor 없는 링크(파일 전체 링크)도 파일 존재 여부만 검증하므로 빌드 실패는 없다. 다만 독자가 `§2-4` 를 anchor 로 오해하면 섹션을 찾지 못한다. swagger.md 의 해당 섹션 heading 은 `### 2-4. 상태 코드 응답 규칙` 이며 slug 는 `#2-4-상태-코드-응답-규칙` 이다.
- **제안**: 링크를 `[swagger.md §2-4](./swagger.md#2-4-상태-코드-응답-규칙)` 로 anchor 를 명시하거나, `[swagger.md](./swagger.md) §2-4` 처럼 텍스트 외부로 꺼낸다. 필수 수정은 아님.

---

## 요약

`spec/conventions/error-codes.md` 초안(draft)은 frontmatter(id/status/code), 문서 3섹션 구조(Overview/본문/Rationale), 파일 명명, 기존 cross-reference anchor 의 정확성 측면에서 정식 규약을 대체로 준수한다. 신규 §3 행 추가는 구현 사실(`workspace-invitations.service.ts` 실제 코드)과 정합하며, 링크 anchor(`#18-초대-재발송--취소` 의 double-hyphen 포함)도 github-slugger 동작과 일치해 유효하다. 다만 두 가지 WARNING 이 있다: (1) 같은 모듈에서 발행되는 `workspace_not_found` · `user_not_found` · `admin_required` 가 §3 에 미등재된 상태로 남아 "명시적 레지스트리" 의 completeness 가 불완전하고, (2) §3 예외 근거를 "클라이언트 분기 없는 모듈 일관성" 으로 확장하는 결정이 `## Rationale` 에 기록되지 않아 향후 검토자가 설계 의도를 파악하기 어렵다. 어느 쪽도 다른 시스템의 invariant 를 직접 깨지는 않는다.

---

## 위험도

**LOW**
