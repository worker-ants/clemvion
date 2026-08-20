# RESOLUTION — 11_01_55

대상 SUMMARY: `review/code/2026/08/20/11_01_55/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **1**, INFO 10)

**처분: WARNING 1건 수정. 코드 변경 0건** — 지적이 전부 문서(수치 서술)였다.

---

## WARNING 1 — 내 뮤테이션 수치가 또 틀렸다 (testing) — **수정**

리뷰어가 옳다. 그리고 이번엔 **내가 리뷰어를 틀렸다고 재정정한 것 자체가 오류**였다.

경위:

| 라운드 | 내 주장 | 실제 |
|---|---|---|
| 최초 | 키 축 8 RED | ✗ |
| `14_00_15` 리뷰어 | 5 RED | **✓** |
| 내 재정정 | "6 RED, 리뷰어가 `x-auth-token` 을 빠뜨렸다" | ✗ |
| `11_01_55` 리뷰어 | 5 RED (재지적) | **✓** |

**원인은 세 번 다 같았다 — 뮤턴트를 손으로 재구성했다.** 직전 정규식은

```
…|cookie|x[_-]api[_-]?key|x[_-]auth[_-]?token)$/i
```

인데 내 sed 는 가운데 토막만 바꿔 꼬리의 `x[_-]auth[_-]?token` 을 복원하지 않았다. 즉 실제로는
존재한 적 없는 결손을 만든 **무효 뮤턴트**였고, 그래서 `x-auth-token` 이 RED 로 나와 6 이 됐다.

이번엔 리뷰어 권고대로 `git show 45ba37792~1:<path>` 출력을 **그대로 파일에 밀어 넣어** 재현했다
(손 재입력 0):

- 키 축 → **5 RED** (`id_token`·`csrf_token`·`csrfToken`·`session_token` + 캐너리 `nextPageToken`)
- 값 축 → **6 RED** (`token`·`csrf_token`·`csrfToken`·`session_token`·`x-auth-token` + 쿼리스트링)

두 축의 숫자가 다른 것은 **값 축 옛 목록엔 `x-auth-token` 대안이 애초에 없었기** 때문이다.

정정한 곳:

- `plan/in-progress/eia-secret-pattern-token-family.md` — 키 축 6→**5**, 그리고 절차를 못박음:
  *"뮤턴트는 손으로 적지 말고 `git show <SHA>~1:<path>` 출력을 그대로 넣는다"*
- `review/code/2026/08/17/14_00_15/RESOLUTION.md` — "리뷰어가 틀렸다" 서술을 사실대로 정정

**코드는 손대지 않았다** — 리뷰어도 *"프로덕션 정규식·신규 회귀 테스트 자체는 기능적으로
올바름"* 으로 판정했고, 결함은 내 증거 서술에만 있었다.

---

## 곁들여 닫은 것 — consistency `11_02_33` WARNING 1

직전 PR 의 plan(`eia-masked-prefill-roundtrip-guard.md`)이 #1181 머지 후에도 `in-progress` 에
남아 있었다. 체커는 *"다른 worktree 소유라 여기서 직접 고치지 않음"* 으로 유예했는데,
**그 전제가 낡았다** — 소유 worktree 는 머지 후 reaped 되어 존재하지 않는다(`git worktree list`
로 실증). 아무도 안 고칠 상태라 이 세션이 종결했다.

- 체크박스 `- [ ] push → PR` → `[x]` + 머지 SHA 명기, `status: in-progress` → `complete`
- `plan/complete/` 로 이동. **편집 → `git add` → `git mv` 순서**로 stale-blob 함정을 피했고
  인덱스 blob 이 편집본임을 `git show :<path>` 로 확인
- **인입 참조를 정규식이 아니라 선형 스캐너로 전수** — 277건이 전부 `review/**` 산출물(불변
  기록)이고 `spec/`·`plan/`·docs 에는 0건이라 깨지는 살아있는 링크가 없다

## 미반영 INFO (10건)

전부 리뷰어가 "조치 불요" 로 판정했거나(1·2·3·5·6·10) 명시적 선택 사항이다(4·7·8·9).
8(미러 테스트 스타일 통일·공유 fixture 추출)과 9(대문자 캐너리)는 다음 라운드를 여는 값보다
얻는 것이 작아 넘긴다 — 발견의 성격이 문서·스타일 층으로 내려온 수렴 신호다.

## 검증

**codebase 변경 0건** (`git status --porcelain -- codebase/` → 0). 이번 라운드 수정은 plan 2건과
RESOLUTION 1건뿐이라 직전 TEST WORKFLOW 결과(lint/unit/build/e2e 4단계 PASS,
backend 427 suites·8,832 / frontend 6,030 / e2e 276 + playwright 51)가 그대로 유효하다.
