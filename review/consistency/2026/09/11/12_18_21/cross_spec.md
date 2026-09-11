# Cross-Spec 일관성 검토 — `spec/5-system/` 구현 (--impl-done)

## 검토 범위와 방법

`spec/5-system/` 자체는 이번 diff(`origin/main...HEAD`)에서 변경되지 않았다(0 파일) — 이 브랜치는
이미 `origin/main` 에 병합된 `2-api-convention.md §5.3`(*"`details` 항목이 `field` 를 실으면
`code` 도 싣는다"*, 커밋 `94e19be8d`)규약을 **코드에 배선**하는 PR 이다. 실제 코드 diff(10파일/
`codebase/` 기준)를 워킹트리에서 직접 읽고, 그 변경이 걸치는 다른 spec 영역(`spec/2-navigation/
2-trigger-list.md`, `spec/4-nodes/7-trigger/providers/{slack,discord}.md`, `spec/conventions/
error-codes.md`, `spec/5-system/15-chat-channel.md`, `spec/5-system/1-auth.md`)을 대조했다.
프롬프트 예산 절단으로 `15-chat-channel.md`·`1-auth.md` 등 대부분의 `spec/5-system/*` 본문이
생략돼 있어, 관련 절은 저장소에서 직접 `grep`/`Read` 했다.

이미 알려져 처리된 항목(`2-trigger-list.md` botToken 형식 정규식 provider 무자격 — planner 사안으로
`--impl-prep` `10_28_52`에서 WARNING 처리, 이 PR 범위 밖으로 확정)은 재기재하지 않는다.

---

## 발견사항

- **[WARNING]** `details[].code` 배선이 완료된 필드의 예시를, 그 필드를 문서화하는 **다른 spec
  영역**이 `code` 없이 여전히 인용 중이다 — 두 곳은 신규 발견(미등재), 한 곳은 이미 트래킹됨
  - target 위치: 이번 diff `codebase/backend/src/modules/triggers/triggers.service.ts` — `botTokenRef`
    (L654-658)·`inboundSigningRef`(L660-664)·`inboundSigning`(L666-670)·`chatChannel`
    (L730-736)·`provider`(L740-745)·`inboundSigningPlaintext`(3-provider 분기, L794-799·
    L809-815·L821-834) 전부에 `code: ErrorCode.INVALID_FIELD` 신규 추가
  - 충돌 대상 (신규 미등재 2곳):
    - `spec/4-nodes/7-trigger/providers/slack.md:275` — *"위반 시 400 `VALIDATION_ERROR`
      (`details.field='inboundSigningPlaintext'`)"* — `code` 언급 없음
    - `spec/4-nodes/7-trigger/providers/discord.md:297` — 동일 문구, `code` 언급 없음
  - 충돌 대상 (이미 트래킹됨, 참고용):
    - `spec/2-navigation/2-trigger-list.md:119-120,176-178,336` — `botTokenRef`·
      `inboundSigningPlaintext`·`chatChannel`·`provider`·`type` 각 필드의 `details.field='X'` 예시가
      `code` 없이 서술. 이 파일은 frontmatter `code:` 에 이번 diff 대상 파일
      `triggers.service.ts`·`dto/**` 를 **직접 등재**하고 있어 spec-linked 파일이다.
      이 gap 자체는 `plan/in-progress/impl-details-code-wiring.md` INFO 3 /
      `spec-draft-nullable-notation-followups.md`(라인 2237 부근, *"두 분기가 §5.4.1 표·
      2-trigger-list.md 에 미등재라는 트래커 서술은 여전히 참"*)가 이미 인지·추적 중이다.
  - 상세: `assertInboundSigningPlaintextByProvider` 는 slack/discord 공용 헬퍼이고, 그 형식
    검증 실패 응답을 문서화하는 자리가 정확히 위 두 provider spec 이다. 이번 PR 이 그 헬퍼의
    모든 발행 지점(707·794·809·821·830줄)에 `code`를 추가했으므로, 실제 wire 응답은 이제
    `{ field: 'inboundSigningPlaintext', code: 'INVALID_FIELD' }` 인데 slack.md/discord.md 는
    여전히 `{ field: 'inboundSigningPlaintext' }` 만 보여준다. 기능을 깨는 모순은 아니지만(추가된
    키를 "없다"고 명시한 것이 아니라 생략), 소비자가 이 문서만 보고 `code` 부재를 가정하면
    분기 로직을 못 짤 수 있다 — `2-api-convention.md §5.3` 이 바로 그 분기 가능성을 위해 `code`를
    의무화한 절이다.
  - 제안: planner 턴에서 `slack.md:275`·`discord.md:297`·`2-trigger-list.md:119-120,176-178,336`
    에 `details.code='INVALID_FIELD'` 를 함께 적어 SoT(§5.3)와 도메인 미러 문서를 동기화한다.
    이미 이 PR 이 `codebase/frontend/.../triggers.mdx`(`triggers.en.mdx`)의 `chatChannel`/
    `provider` 두 사례는 `code` 를 반영해 갱신했으므로, 같은 갱신을 spec 쪽에도 미러링하면 된다.
    코드 동작 변경은 불필요 — 순수 문서 동기화라 CRITICAL 로 올리지 않았다.

---

## 요약

이번 diff 는 `spec/5-system/2-api-convention.md §5.3`(이미 `origin/main`에 병합된 규약)을 코드에
배선하는 순수 구현 PR 로, `spec/**` 자체는 건드리지 않는다. 배선된 15자리(`triggers.service.ts`
13곳 + `password.util.ts` 2곳)와 신규 `botToken` `@MinLength(1)`·공유 메시지 상수화는 모두
`2-api-convention.md §5.3`·`error-codes.md`(`INVALID_FIELD` 는 이미 카탈로그 등재, 신규 등재
불요)·`common/` → `nodes/` import 미선례(실측 0건, 문서 없음) 등 관련 규약과 정합적이며, 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 축에서 CRITICAL 급 모순은 발견되지 않았다.
유일한 발견은 이 PR 이 실제로 변경한 응답 shape(`details.code` 추가)을 `2-trigger-list.md`
(이미 트래킹됨)와 `providers/{slack,discord}.md`(신규 발견, 미등재)가 예시에서 계속 누락하는
비파괴적 문서 동기화 gap 이며, planner 턴에서 함께 갱신하면 해소된다.

## 위험도

LOW
