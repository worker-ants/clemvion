# Rationale 연속성 검토 — spec/5-system/14-external-interaction-api.md §R14 addendum 재검증

## 조사 방법 (직전 라운드 `16_51_08` WARNING 처분에 대한 사실 검증)

직전 라운드에서 낸 WARNING("§R14 본문이 `403 TOKEN_REFRESH_FORBIDDEN` 을 스스로 설명하지 않는다")이
"범위 복원" 형태의 blockquote 로 처분됐다. 그 blockquote 가 새로 쓴 역사적 주장 3개 + 앵커 영향 +
결정 성격을 하나씩 실측했다.

- `git diff -- spec/5-system/14-external-interaction-api.md` 로 이번 세션의 실제 변경분(§5.1 표 3행
  + 콜아웃 재기술, §5.2 blockquote, §5.5 응답 블록 재작성, R14 제목/본문/신규 blockquote)을 격리.
- `git log --all -S"TOKEN_REFRESH_FORBIDDEN" -- codebase/backend/` 로 코드 최초 도입 커밋 확인.
- `git log --all -S"### R14" -- spec/5-system/14-external-interaction-api.md` 로 R14 도입 커밋 확인 +
  `git show <commit>` 으로 그 커밋의 실제 diff(커밋 메시지 포함) 확인.
- `git log --all -G'itk_\*.*403|403.*itk_\*' -- spec/data-flow/15-external-interaction.md` +
  `git show <commit> -- spec/data-flow/15-external-interaction.md` + `git blame -L` 로 data-flow
  §1.2 "`itk_*` 는 403" 문장의 **실제 도입 커밋**을 R14 도입 커밋과 대조.
- `git merge-base --is-ancestor` 로 두 커밋의 선후 관계 확정.
- 직전 라운드(`16_51_08`)가 디스크에 남아 있어 `rationale_continuity.md` 원문을 직접 읽어, orchestrator
  가 옮겨 적으며 왜곡했는지 vs 원래 그 라운드 자체의 결론이었는지 분리.
- `interaction.service.ts`/`interaction.guard.ts` 소스로 "판정 지점이 다르다"(Guard 통과 후 서비스
  계층) 주장의 코드 근거 재확인.
- `grep -rni "#r14"` (repo 전체) + `14-external-interaction-api.md#` 링크 전수로 앵커 파손 여부 확인.

## 발견사항

- **[WARNING]** R14 addendum 의 "같은 커밋" 이력 주장이 사실과 다르다 — 4일 앞선 별개 PR 이었다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §Rationale R14, 신규
    "> **범위 명확화 (2026-08-11)**" blockquote 세 번째 문단 — "본 결정과 **같은 커밋**에서 쓰인
    [data-flow §1.2](../data-flow/15-external-interaction.md) 도 "`itk_*` 는 403" 이라 적고
    있었다. 즉 R14 의 저자도 이 예외를 알고 범위를 Guard 로 좁혀 적었으나 …" (현재 파일
    1173–1176행 부근)
  - 과거 결정 출처: 이 주장 자체가 참조하는 두 커밋 —
    (a) R14 도입 커밋 `907616c61`(#604, 2026-06-14 17:29): 커밋 메시지 "R14(401 통일 근거) 신설"
    + 본문 "data-flow/15 §3.1 은 **이미** 401·TOKEN_* 정합" (즉 저자 자신이 §3.1 은 검토했다고
    명시하지만, §1.2 는 언급 없음).
    (b) data-flow §1.2 "`itk_*` 는 403" 문장의 실제 도입 커밋 `db496a3c2`(#516, **2026-06-10
    13:59**, "data-flow 재구성") — `git blame -L 120` 이 이 커밋 하나로 귀속되고, 그 diff 에
    해당 줄이 `+` (신규 추가)로 나타난다. `git merge-base --is-ancestor db496a3c2 907616c61` →
    true, 즉 db496a3c2 는 907616c61 보다 **4일·별도 PR 앞선** 조상 커밋이다.
    `907616c61` 의 실제 diff(`git show 907616c61 -- spec/data-flow/15-external-interaction.md`)는
    idempotency 캐시 행·`terminal-revoke-reconcile` 큐 행·상태 다이어그램 전이 라벨·fail-open
    문단만 건드리며, `itk_* 는 403` 줄(§1.2, 현재 120행)은 **전혀 건드리지 않는다.**
  - 상세: "같은 커밋에서 쓰였다" 는 "동시에 작성돼 저자가 그 사실을 인지한 채 R14 범위를
    의도적으로 좁혔다" 는 강한 서사를 뒷받침하는 근거로 쓰였다. 그러나 실측하면 두 문장은
    **다른 커밋, 다른 PR, 4일 시차**이고, R14 를 쓴 커밋의 diff 는 그 특정 줄을 지나치지도
    않았다. 흥미롭게도 이 오류는 orchestrator 가 옮겨 적으며 왜곡한 게 아니라 — 디스크에 남은
    직전 라운드(`review/consistency/2026/08/11/16_51_08/rationale_continuity.md` 23행)를 직접
    읽어 대조한 결과 — **그 라운드 자체의 결론**이었다. 그 라운드의 "조사 방법"은
    `git log -S"TOKEN_REFRESH_FORBIDDEN"` 과 `git log -1 907616c61` 만 실행했고, data-flow §1.2
    줄 자체에 대한 `git log -S`/`git blame` 은 돌리지 않았다 — "커밋이 그 **파일**을 건드렸다"
    (사실, 9줄 변경)와 "커밋이 그 **줄**을 도입했다"(거짓)를 구분하지 않고 결론 내린 것으로
    보인다. 다만 결론이 뒷받침하려던 **상위 주장**(TOKEN_REFRESH_FORBIDDEN 신설은 §R14 가 기각한
    대안의 재도입이 아니다)은 이 오류와 무관하게 별도 근거(claim 1·2, 아래 참조)로 여전히 참이다
    — 즉 서사의 "정도"(저자가 능동적으로 알고 좁혔다)만 과장됐고, "결론"(예외가 정당하다)은
    무너지지 않는다.
  - 제안: blockquote 세 번째 문단을 다음과 같이 정정 — "이 예외는 새로 만든 것이 아니다 —
    `TOKEN_REFRESH_FORBIDDEN` 은 구현 최초 커밋(#230)부터 존재했고, [data-flow §1.2](...) 도
    R14 도입(#604, 2026-06-14)보다 4일 앞선 #516(2026-06-10, `db496a3c2`)에서부터 "`itk_*` 는
    403" 이라 적어 왔다. R14 저자가 이 사실을 실제로 인지했는지는 커밋 이력만으로 확정할 수
    없으나(#604 커밋 메시지는 data-flow §3.1 을 언급할 뿐 §1.2 는 언급하지 않는다), 적어도 R14
    도입 시점에 이미 저장소 안에 상충하는 서술이 존재했다는 사실 자체는 확인된다." — "같은
    커밋" 이라는 검증 가능한 오류만 제거하면 나머지 근거(판정 지점이 다르다·노출 이득 없다)는
    코드로 뒷받침되므로 그대로 유지 가능.

## 확인했으나 문제 없다고 판단한 항목 (실측 근거)

1. **주장 1 — "기각된 것은 scope/audience 불일치를 403 세분, 그 두 코드는 지금도 401" — 참.**
   R14 본문(불변, 이번 diff 미수정 영역): "scope/audience 불일치를 HTTP 시맨틱대로 `403
   Forbidden`… 세분하는 대안은 기각한다." §5.1 표 현재 상태: `TOKEN_SCOPE_MISMATCH` →
   `401 Unauthorized`, `TOKEN_AUDIENCE_MISMATCH` → `401 Unauthorized` (둘 다 유지, 이번 diff 는
   두 행을 건드리지 않음). `TOKEN_REFRESH_FORBIDDEN` 은 이 두 코드와 무관한 별개 코드이므로,
   신설된 403 은 R14 가 명시적으로 기각한 대안("scope/audience → 403")의 재도입이 **아니다.**

2. **주장 2 — "`TOKEN_REFRESH_FORBIDDEN` 은 구현 최초 커밋(#230)부터 존재" — 참.**
   `git log --all -S"TOKEN_REFRESH_FORBIDDEN" -- codebase/backend/` 결과 매치 커밋은
   `35ff9c19b`(#230, PR2) **단 하나** — 즉 등장 이후 제거·재도입 없이 지금까지 코드에 존재.
   현재도 `interaction.service.ts:224` 의 `refreshToken()` 이 `ctx.tokenFamily !== 'iext'` 분기에서
   `ForbiddenException({code:'TOKEN_REFRESH_FORBIDDEN', …})` 을 던진다.

3. **"판정 지점이 다르다"(Guard 통과 후 서비스 계층) — 코드로 확인됨.**
   `interaction.guard.ts` 의 `deny()` 는 `UnauthorizedException` 만 던진다(403 분기 없음).
   `TOKEN_REFRESH_FORBIDDEN` 은 Guard 를 통과한 뒤 `interaction.service.ts` 의 `refreshToken()` 이
   던지는 별개 예외다. R14 가 보호하는 Guard-레벨 invariant(`deny()` = 401 전용)는 코드·문서
   양쪽에서 그대로 유지된다.

4. **앵커 파손 여부 — 없음.** 제목이 "R14. 토큰 실패…" → "R14. 토큰 **검증** 실패…" 로 바뀌었으나,
   `grep -rni "#r14"`(repo 전체, spec/plan/codebase/review 포함) **0건** — R14 를 markdown fragment
   로 가리키는 링크 자체가 존재하지 않는다(같은 라운드의 `naming_collision` checker 도 독립적으로
   0건 확인). `3-error-handling.md:171` 의 `[EIA §R14](./14-external-interaction-api.md)` 를
   포함해 저장소 내 모든 "R14" 참조는 **앵커 없는 파일 링크이거나 텍스트 라벨**("§R14",
   "§Rationale R14")뿐이라 제목 문구 변경에 영향받지 않는다.

5. **결정 자체를 바꾸는가, 원래 범위를 복원하는가 — "복원" 프레이밍은 다소 관대하나 실질적으로는
   범위 명확화이지 결정 번복이 아니다.** R14 의 채택/기각 핵심 내용(scope/audience 불일치는
   401 로 통일한다, Guard 는 401 전용)은 이번 diff 에서 **글자 하나 안 바뀌었다** — 바뀐 것은
   제목·서두의 "모든 토큰류 **실패**" → "모든 토큰류 **검증** 실패" 라는 수식어 추가와, 그 좁혀진
   범위 밖에 있는 새 예외(`TOKEN_REFRESH_FORBIDDEN`)를 명시하는 blockquote 추가뿐이다. 다만
   "복원"(restore)이라는 단어는 "원래 그렇게 좁았던 범위가 일시적으로 넓게 잘못 쓰였다가 되돌아간
   것"을 함의하는데, R14 의 문자 그대로의 텍스트는 #604 도입 시점부터 이번 diff 직전까지
   **한 번도 "검증" 이라는 한정어나 refresh 예외를 담은 적이 없었다** — 즉 문언 자체가 좁았던
   적은 없고, 이번이 그 좁은 해석을 **처음으로 명문화**하는 것이다. 그럼에도 이 처분은 체크리스트
   관점(§3 "결정의 무근거 번복 여부")에서는 합격이다 — 결정을 뒤집으면서 새 Rationale 를
   **함께** 작성했고(날짜 부기 blockquote, R16 의 기존 관례와 동형), 실질적 정책(scope/audience
   = 401, Guard = 401 전용)도 안 바뀌었기 때문에 "번복"보다는 "명확화"로 보는 것이 더 정확한
   표현이다 — "복원"이라는 단어 선택만 실제보다 강한 연속성을 주장하고 있다.

## 요약

R14 addendum 이 담은 3개 역사적 주장 중 2개(scope/audience 403 기각 및 지금도 401 · 
`TOKEN_REFRESH_FORBIDDEN` 이 #230부터 존재)는 git 이력으로 확인되는 사실이다. 그러나 세 번째
("data-flow §1.2 가 R14 와 **같은 커밋**에서 쓰였다")는 실측 결과 거짓이다 — 두 문장은 4일·별도
PR(#516 vs #604) 차이가 나고, R14 를 도입한 커밋의 diff 는 문제의 그 줄을 건드리지도 않았다. 이
오류는 이번 orchestrator 의 옮겨적기 왜곡이 아니라 **직전 rationale_continuity 라운드
(`16_51_08`) 자체의 결론**이었음을 디스크에 남은 원문 대조로 확인했다 — "커밋이 파일을 건드렸다"
와 "커밋이 그 줄을 도입했다"를 혼동한 것으로 보인다. 다만 이 오류가 지지하려던 상위 결론(신설된
`403 TOKEN_REFRESH_FORBIDDEN` 은 R14 가 기각한 대안의 재도입이 아니며, Guard-레벨 invariant 도
안 깨졌다)은 별도 근거로 여전히 유효하다 — 즉 **결론은 옳고 그 결론을 뒷받침하는 곁가지 이력
서술 하나가 틀렸다.** 앵커 파손은 없고(R14 를 가리키는 fragment 링크 자체가 저장소에 없음), 이번
재기술은 R14 의 실질 결정을 바꾸지 않는다. 다만 "저자도 알고 범위를 좁혀 적었다"는 의도-귀속
서술과 "복원"이라는 단어는 실제 문언 이력보다 강한 연속성을 주장하므로, 이 저장소가 이미 겪은
"지어낸 Rationale" 패턴이 곁가지 형태로 재발한 사례로 기록해 정정을 권고한다.

## 위험도
LOW

BLOCK: NO
STATUS: OK
