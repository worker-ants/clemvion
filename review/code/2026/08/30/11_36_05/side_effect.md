STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 커밋 메시지가 `plan/complete/spec-draft-egress-masking-convention.md` 의 인입
  링크 2건을 "백틱 코드 스팬이라 대상 아님" 으로 잘못 서술 — 실제로는 살아있는 마크다운 링크다
  (기능적 위험은 없음, 아래 설명)
  - 위치: 커밋 `10f7a2350` 메시지 "`## complete/ 이동`" 절 (`나머지 참조는 백틱 코드 스팬이라
    대상 아님`) / 실제 대상 파일 `plan/complete/spec-draft-egress-masking-convention.md:118`,
    `:138` (이 리뷰 대상 diff 밖의 파일 — `Read` 로 직접 확인한 실제 줄 번호)
  - 상세: 이 PR 은 `plan/in-progress/ws-event-types-extract.md` 를 `plan/complete/` 로
    `git mv` 한다(파일 3/6). 커밋 메시지는 "살아있는 인입 링크는 `spec-sync-…-gaps.md:1386`
    1건뿐이고 나머지 참조는 백틱 코드 스팬이라 링크 갱신 대상이 아니다" 라고 주장한다.
    직접 grep 한 결과 `plan/complete/spec-draft-egress-masking-convention.md:118`·`:138` 에
    `` [`ws-event-types-extract.md`](../in-progress/ws-event-types-extract.md) `` 형태의
    **진짜 마크다운 링크**가 2건 있고, 이 PR 로 그 대상 파일이 사라지므로 이동 후 이 링크들은
    DEAD 가 된다(`git show origin/main:plan/in-progress/ws-event-types-extract.md` 존재 →
    `git show HEAD:...` 부재로 실측 확인). 즉 "백틱 코드 스팬" 이라는 근거 자체는 부정확하다 —
    링크 텍스트만 백틱으로 감쌌을 뿐 `[..](..)` 문법을 가진 실제 하이퍼링크다.
    다만 **기능적 위험은 없다** — `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의
    `findBrokenPlanLinks`/`collectLivePlanMarkdown` 주석이 명시적으로
    `plan/complete/**` 를 스캔 범위에서 제외한다: *"`plan/complete/**` is excluded, because
    `plan-lifecycle.md §3` keeps point-in-time records on their old paths, so the broken
    links there are the documented-normal state"*. 이 프로젝트는 `plan/complete/**` 안의
    깨진 링크를 "시점 기록이라 옛 경로 유지가 규약" 으로 이미 문서화해 뒀고(같은 PR 이 옮기는
    `ws-event-types-extract.md` 본문도 동일 문구로 이를 정확히 예견해 뒀다), push 게이트의
    `spec-link-integrity`/`plan-scan` 가드 195 tests 도 이 파일을 건드리지 않으므로 CI 를
    깨뜨리지 않는다.
  - 제안: 기능 변경은 불필요. 다음에 이 커밋 메시지를 인용·근거로 쓸 사람을 위해서만,
    "백틱 코드 스팬이라 대상 아님" 대신 "plan/complete/** 링크는 규약상 스캔 제외 대상이라
    갱신 불요(마크다운 링크 자체는 존재)" 로 정정하면 정확하다. 이 저장소가 반복 기록해 온
    "정정 대상 문장을 인용의 출처로 쓰지 않는다"·"실측했다는 주장은 실제 수량으로" 패턴과
    같은 종류의 사소한 근거 오기이므로 다음 PR 이 이 커밋 메시지를 근거로 재인용할 때만
    문제가 된다.

## 점검한 항목 (이상 없음)

- **`websocket.service.spec.ts`**: `import { InAppNotificationEventType } from './websocket.service'` +
  `describe('re-export facade', …)` 신설은 순수 테스트 추가다. `websocket.service.ts:27,44`
  에서 해당 값이 실제로 재수출됨을 직접 확인했다(`grep`). 새 테스트는 `beforeEach` 로 만들어지는
  공유 `service`/`gateway` mock 을 전혀 쓰지 않아(정적 enum 값만 단언) 다른 `it` 블록의 상태와
  간섭하지 않는다. 프로덕션 코드·함수 시그니처·공개 API·환경변수·네트워크 호출·이벤트/콜백
  경로는 이 diff 에서 전혀 바뀌지 않았다.
- **plan 파일 4건의 `git mv`/편집** (파일 2~6): 전부 plan lifecycle 이동(체크박스 flip,
  frontmatter `status`/`spec_impact` 갱신, 완료 메모 추가)이다. `git diff` 가 `rename
  from/to … similarity index 96%` 로 정상적인 rename 임을 확인했다(히스토리 보존, blame 안전).
  이 이동이 갱신을 요구하는 **유일한 살아있는 인입 링크**(`plan/in-progress/spec-sync-external-
  interaction-api-gaps.md:1386`)는 diff(파일 5)에서 `../complete/ws-event-types-extract.md`
  로 정확히 갱신됐고, 상대경로 해석도 맞다(파일이 `plan/in-progress/` 에 있으므로 `../complete/`
  가 옳다). `spec/conventions/egress-masking.md:89` 캐비엇도 실제로 회수돼 더 이상 plan 경로를
  가리키지 않음을 직접 읽어 확인했다.
- 저장소 파일시스템에 이 리뷰가 남긴 미검증 잔여물 없음 — 검증은 전부 `Read`/`grep`/`git show`
  등 읽기 전용으로 수행했고 `git status --short` 결과 이 산출물 디렉터리 외 변경 없음.

## 요약

이 PR 의 실질 코드 변경은 `websocket.service.spec.ts` 에 대한 순수 테스트 추가 한 건뿐이며,
전역 상태·시그니처·공개 API·환경변수·네트워크·이벤트 경로에 아무런 영향이 없다. 함께 포함된
plan 문서 4건의 이동/편집은 이 저장소의 plan lifecycle 규약을 따르고 있고, `git mv` 로 인한
유일한 실질 부작용 후보(다른 plan 문서 안의 인입 링크 2건이 새로 DEAD 가 되는 것)는 이 프로젝트가
`plan/complete/**` 를 링크 가드 스캔 범위에서 명시적으로 제외해 둔 문서화된 정상 상태이므로
CI/게이트를 깨뜨리지 않는다. 다만 그 부분을 정당화하는 커밋 메시지 한 줄("백틱 코드 스팬이라
대상 아님")이 사실과 다르다(실제로는 살아있는 마크다운 링크다) — 결과에는 영향이 없는 근거상의
사소한 부정확이라 INFO 로만 남긴다.

## 위험도

NONE
