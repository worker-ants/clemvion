# RESOLUTION — `review/code/2026/09/06/13_39_20` (+ consistency `13_39_25` · `13_52_23`)

**원 결과**: 코드 리뷰 Critical **1** · WARNING 3 · 위험도 HIGH ·
consistency `13_39_25` BLOCK:NO · WARNING 3 ·
consistency `13_52_23` **BLOCK:YES** · Critical **1**
**처분**: 두 Critical 은 **같은 뿌리**였다 — 회피하지 않고 파서를 고쳤다. WARNING 6건 + INFO 2건 수정.

---

## Critical (양쪽) — 내가 껐다. 그리고 그것이 이미 꺼져 있었다

### 무엇이 났나

직전 커밋이 `review-citations.md` 의 `code:` 에 **인라인 YAML 주석**을 넣었다
(`review/consistency/2026/09/06/13_18_59` INFO#2 의 제안). 게이트 파서
`review_guard._parse_frontmatter_code` 의 블록 리스트 루프는 `- ` 로 시작하지 않는 첫
줄에서 `break` 한다.

| | 파싱된 entry |
|---|---|
| `origin/main` | 2 |
| 내 커밋 | **0** |

등재하려던 파일이 안 걸린 것은 물론이고 **이미 걸려 있던 `sanitize-loader-error.ts` 까지
감사망에서 빠지는 회귀**다. *"가드를 약화시키면 게이트가 문다"* 를 선언하면서 정확히 그
게이트를 껐다.

### 회피하려다 더 큰 것을 봤다

하루 전 같은 함정을 밟고 `spec-draft-api-convention-verifier-registration.md` 에
*"주석을 쓰지 않는 것으로 회피했다"* 라고 적어 뒀는데, **다른 라운드의 checker 가 인라인
주석을 제안하자 그대로 채택했다.** 산문 규율은 다음 제안을 막지 못한다.

그래서 회피 대신 저장소를 전수로 쟀다:

```
spec md files: 387
gate entries : 690      ← 게이트가 본 것
yaml entries : 731      ← 진짜 YAML(gray-matter)이 본 것
dropped      : 41
files differing: 7
```

7개 파일 — `2-navigation/{_layout, 9-user-profile, 10-auth-flow, 11-error-empty-states}.md` ·
`7-channel-web-chat/{2-sdk, 3-auth-session}.md` · `conventions/user-guide-evidence.md`.

**그중 하나가 이 PR 자신을 덮고 있었다.** `9-user-profile.md` 의 15번째 entry
`codebase/backend/src/modules/workspaces/**` 가 주석 뒤라 유실 중이었고, 이 PR 이 고친
`workspace-response.dto.ts` 가 거기 걸린다. 즉 `--impl-done` Gate 2 는 이 PR 의 그 파일을
**애초에 보고 있지 않았다** (`13_52_23` Critical 1 — checker 가 독립 발견).

### 고친 것 — 문서가 아니라 파서

`_parse_frontmatter_code` 의 블록 리스트 루프가 **빈 줄·`#` 주석을 건너뛴다.** `break` 는
다음 키에서만.

| | 수정 전 | 수정 후 |
|---|---|---|
| 게이트 파서 entry | 690 | **731** |
| gray-matter entry | 731 | 731 |
| 답이 갈리는 파일 | 7 | **0** |

**두 파서가 유효한 YAML 에 다른 답을 내던 상태를 닫았다.** 프런트엔드
`spec-frontmatter-parse.ts` 는 처음부터 주석 뒤를 봤다 — `spec-code-paths.test.ts` 는
통과시키고 `--impl-done` 은 못 보는 비대칭이었다.

**회귀 테스트 3건** (`.claude/tests/test_review_guard.py`):

| 테스트 | 수정 전 | 의도 |
|---|---|---|
| 주석 뒤 항목 생존 | **RED** | 결함 그 자체 |
| 빈 줄 뒤 항목 생존 | **RED** | 같은 클래스 |
| **다음 키에서는 멈춘다** | GREEN | 넓힌 술어의 **반대 방향 대조군** — 이게 없으면 리스트가 다음 키를 삼키는 방향으로 넓어져도 통과한다 |

harness 스위트 1,124 pass + 1,254 subtest.

**7개 spec 파일은 손대지 않았다** — 고칠 것이 문서가 아니었기 때문이다. 파서가 고쳐지자
41개 entry 가 그대로 살아났다. checker 가 권고한 (a) 7개 파일 스윕은 인스턴스를 고치고
클래스를 남긴다. (c) 파서 수정이 클래스를 닫는다.

그 결과 `code:` 인라인 주석이 **이제 안전하므로** 원래 제안대로 되살렸고, 두 spec 문서의
서술도 "쓰지 마라" 에서 "2026-09-06 이후 안전하다" 로 바꿨다.

---

## WARNING

| # | 출처 | 처분 |
|---|---|---|
| W2 architecture | `13_39_20` | `EXPECTED_USER_RELATION_LOADS` 3항목의 **방어 강도가 다르다**를 표로 명시. `logout`·`refresh` 는 반환 경로 자체가 없고, `listMembers` 는 **JS 단 수동 매핑**이라 이 가드가 못 지킨다 — 안전망이 e2e `workspace-rbac` J. 하나뿐임을 항목 주석에 박았다 |
| W3 maintainability | `13_39_20` | fixture 경로 인라인 3중복 → `CITATION_FIXTURE` 상수. 자매 `swagger-dto-contract.spec.ts` 의 `RATCHET_FIXTURE` 관례를 따랐다 |
| W4 documentation | `13_39_20` | plan 인계표 1행이 `user-entity-exposure-guard*.ts` 를 지시하면서 **세 줄 아래에서 그것을 금지**하고 있었다 → `user-entity-exposure*.ts`. 실측 2/2 vs 1/2. 표 옆에 캐비아트를 직접 붙였다(표가 지시문이므로) |
| W1·W2 | `13_39_25` | §5.4 검증자 등재 · `User` 7컬럼 규범 문장 — 둘 다 `spec/` 쓰기라 developer 권한 밖이고 `spec-draft-nullable-notation-followups.md` 375~424 · 426~436 행에 등재돼 있음을 **행 번호까지 확인**했다 |
| W3 | `13_39_25` | `WorkflowVersionDetail` 이 프런트엔드 `lib/api/workflows.ts:109` 의 동명 인터페이스와 충돌 — **이전 3라운드가 "유일 정의" 로 오판**한 것을 이번 checker 가 정정. grep 으로 양쪽 실존 확인. 개명·공유 패키지화는 범위 밖이라 백엔드 타입에 미러 고지 JSDoc |
| W1 | `13_52_23` | *"국소 패턴 반복"* 경고 — 파서 수정으로 해소. 이 라운드가 바로 그 전역 처분이다 |

## INFO

| # | 처분 |
|---|---|
| `13_39_20` #15 | `findUserSecretLeaks` depth-0 분기 단언 추가. **격리 뮤턴트**(`if (trail && FORBIDDEN.has(key))`)로 **정확히 1 RED** — 이 테스트만 잡는다 |
| `13_39_20` #16 · `13_39_25` #2 | `WorkflowVersion*Dto.creator` 의 §5.4 금지 조합 — **이미 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에 동결된 부채**(4행 중 2행). 새로워진 것은 **방향**: 이 PR 이 런타임을 좁혀 이제 선언이 런타임보다 넓다. plan 에 등재 |
| `13_52_23` #1 | 워킹트리 미커밋 지적 — 이 커밋으로 반영 |
| 나머지 | 확인 기록 · 이미 등재 · 범위 밖 (각 SUMMARY 참조) |

---

## 종결하지 않은 것

`13_52_23` 의 planner 인계 표는 **7개 spec 파일의 주석 제거**를 지시하지만 실행하지
않았다 — 그 지시의 전제(*"주석이 파서를 끊는다"*)를 이 라운드가 제거했기 때문이다. 주석은
이제 안전하고, 7개 파일은 정상 파싱된다(전수 731/731 실측). 인계 자체가 소멸했다.
