# Plan 정합성 검토 — plan-lifecycle-gates (impl-done, scope=spec/conventions/)

## 방법 노트

prompt 의 target 번들(`spec/conventions/`)에는 실제 diff 섹션이 없었다(예산 초과로 생략).
`git diff origin/main...HEAD`(커밋된 변경) + `git diff HEAD`(워킹트리 미커밋 변경, 이 리뷰
수행 중에도 계속 갱신되고 있었다 — `plan-scan.ts`/`spec-links.ts`/`plan-lifecycle.md`/
`spec/conventions/spec-impl-evidence.md` 가 세션 도중 재작성됨)로 실제 변경분을 절대경로
워킹트리에서 직접 확인했다. 아래 발견사항은 **이 리뷰를 마무리하는 시점의 워킹트리 상태** 기준이다.

이번 PR 의 plan 관련 변경 실체(재확인):
- `plan/complete/**` 15개 파일의 `status: in-progress` → `complete` 일괄 정정
  (+ `c1-pr2-aiturn-blueprint.md` 자유서술 분리)
- `plan/in-progress/*.md` 6개 파일, 총 9개 링크 텍스트 수정(전부 `plan/complete/**` 로 실존
  하는 파일 대상 — 파일시스템으로 개별 확인 완료, 깨진 것 없음)
- `plan/in-progress/spec-draft-secret-store-verification-footnote.md` → `complete/` 이동
- `plan/in-progress/harness-env-value-subpattern-dedup.md` 에 새 섹션(walker 중복 후속 2건) 이관 등재
- `.claude/docs/plan-lifecycle.md` §4/§5, `spec/conventions/spec-impl-evidence.md` §2 갱신 + 신규 build guard
  (`plan-scan.ts`/`plan-frontmatter.test.ts`/`spec-links.ts`)

현재 `plan-frontmatter.test.ts` 를 직접 실행해 확인(`vitest run … -t "no broken relative links"`)
— **PASS, 0 violation**. `plan/complete/**` 전수(YAML 파싱 가능한 범위)에서도 비-종료 `status`
0건 확인. 이동·정정 자체는 기능적으로 깨진 것이 없다.

## 발견사항

- **[WARNING]** 이관된 후속 항목이 원 plan 의 주제와 어긋난 자리에 등재됨
  - target 위치: `plan/in-progress/harness-env-value-subpattern-dedup.md` 신설 절
    `## 함께 볼 것 — 문서 가드 트리 walker 3벌 (2026-08-10 이관)`
  - 관련 plan: 동일 파일의 원 본문(§Overview~§Rationale) — `.claude/hooks/guard_review_before_push.py`
    · `guard_default_branch_bash.py` 등 **Python 훅의 정규식 상수 중복**(env-value closer)을
    다루는 plan
  - 상세: 새로 이관된 두 항목(`walkPlanMarkdown`/`collectSpecMarkdown`/`collectCodebaseSources`
    walker 3벌 통합, `SpecMdFile` 타입명 재정의)은 `codebase/frontend/src/lib/docs/__tests__/`
    의 TypeScript build-guard 코드 중복 이슈로, 원 plan 이 다루는 `.claude/hooks/*.py` 정규식
    중복과는 코드베이스·언어·실패 모드(정규식 drift vs 디렉터리 순회 필터 drift)가 전부 다르다.
    공통점은 "DRY vs 안전성 트레이드오프" 라는 느슨한 주제 유사성뿐이다. `plan/in-progress/`
    에 이 walker 통합을 다루는 다른 plan 도 없음을 확인했다(`harness-review-gate-followups.md`
    도 이 항목과 무관한 Python harness 내부 이슈만 다룸). CLAUDE.md 는 "새 plan 은 항상
    `plan/in-progress/` 에서 생성" 을 규정하는데, 이 항목은 기존의 (주제가 다른) plan 에
    편입돼 향후 "TS 문서 가드 walker 중복" 을 찾는 사람이 발견하기 어려운 자리에 놓였다.
  - 제안: 별도 `plan/in-progress/docs-guard-walker-dedup.md`(가칭) 신설을 권장. 최소한으로는
    이관 사유("그 PR 범위 밖")만이 아니라 "왜 이 특정 plan 에 편입했는가" 를 한 줄 추가하거나,
    `.claude/docs/plan-lifecycle.md` 자신이 이 walker 들의 정본 문서이므로 그쪽에서 backlog
    위치를 가리키는 포인터를 남기는 편이 발견성을 높인다.

- **[WARNING]** "깨진 링크는 전부 같은 실패 클래스" 서술이 부정확 — 최소 1건은 가드가 볼 수 없는 위치에 있음
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
    `findBrokenPlanLinks()` 바로 위 JSDoc ("Measured 2026-08-09/10: **9** broken links…")
  - 관련 plan: `plan/complete/spec-draft-secret-store-verification-footnote.md` §후속
    ("그 스코프의 깨진 링크 8건을 전부 정정했고(전부 `complete/` 로 옮겨간 plan 을 가리키던
    것 — 바로 이 실패 클래스다)") — 이 문구는 리뷰 도중 `spec-links.ts` 쪽만 "9건, 그중 2건은
    다른 클래스" 로 갱신됐고, plan 문서 쪽 문구는 아직 옛 "8건 전부 동일 클래스" 그대로다(두
    파일이 같은 사실을 서로 다르게 서술 중인 과도기 상태).
  - 상세: 실제로 이번 PR 이 `plan/in-progress/*.md` 안에서 고친 링크 타깃은 9개 텍스트
    변경(파일 6개)이다:
    - 7개는 `../complete/<name>.md` 로 옮겨간 plan 을 가리키는 정정 (exec-park-durable-resume
      1 · spec-draft-node-cancellation-chat-channel-correction 2 · spec-draft-rag-reranking 1
      · shutdown-classification 안의 같은 링크 2 · webchat-boot-single-flight 1).
    - 1개는 `cafe24-backlog-residual.md` 의 `[통합 §9.2](...#92-주요-api)` →
      `[통합 §9.1](...#91-목록crud)` — **plan 이동과 무관한 spec 앵커 drift**(현재
      `spec/2-navigation/4-integration.md` 에 `#92-주요-api` 슬러그를 만드는 헤딩이 없고,
      실제 헤딩은 "9.2 인증 / 회전 / Scope" 다). `findBrokenPlanLinks` 는
      `checkSelfAnchors:false` 여도 `path#anchor` 조합의 앵커는 항상 검증하므로
      (`spec-links.ts:237-246`), 이 건은 가드가 실제로 잡을 수 있는 ANCHOR 위반이다.
    - 1개는 `spec-fix-swagger-forbidden-response.md` 의 `../5-system/1-auth.md` →
      `../../spec/5-system/1-auth.md` (L81) — 그런데 이 링크는 ```markdown 코드펜스
      (L78~L86) **안**에 있다. `extractLinks()`(`spec-links.ts:79-106`)는
      `FENCE_RE` 로 펜스 안 라인을 스킵하므로(`if (inFence) continue`), 이 링크는
      `findBrokenPlanLinks` 가 애초에 볼 수 없는 위치다 — "가드가 측정했다" 는 서술과
      맞지 않는다(수작업 교정이었을 가능성이 높다).
    - 따라서 가드가 실제로 "측정" 가능한 위반은 최대 **8건**(7 move-class + 1 anchor-drift)
      이고, 펜스 안의 9번째는 가드의 측정 대상이 아니다. "9건 측정, 그중 2건이 다른 클래스"
      라는 지금 `spec-links.ts` 의 서술도 정확히는 "8건을 가드가 측정(1건은 다른 클래스) +
      1건은 가드 밖에서 수작업 정정" 이 더 정확하다.
  - 제안: `spec-links.ts` JSDoc 과 `spec-draft-secret-store-verification-footnote.md` §후속의
    숫자·클래스 서술을 한 번 더 맞추고, 펜스 안 링크(swagger-forbidden-response.md)는 "가드가
    찾은 것" 이 아니라 "가드 스캔 범위 밖에서 별도로 발견해 정정" 으로 구분해 적을 것. 기능
    영향은 없음(가드는 현재 0 violation 로 green) — 순수 서술 정확도 문제.

- **[INFO]** 이동 완료된 파일을 가리키며 여전히 미래시제로 서술
  - target 위치: `plan/in-progress/webchat-command-failure-is-not-termination.md` §선행/참조
    — "되돌림 경위·실측: `plan/complete/` 로 **이동할** [`webchat-boot-single-flight.md`]
    (../complete/webchat-boot-single-flight.md) §후속"
  - 상세: 링크 경로는 이번 PR 에서 `../complete/`로 올바르게 정정됐지만, `webchat-boot-single-flight.md`
    는 이미 `plan/complete/`에 있다(확인 완료). "이동할" 이라는 미래시제 표현만 그대로 남아
    한 문장 안에서 시제가 어긋난다. 기능 영향 없음, cosmetic.
  - 제안: 다음에 이 파일을 편집할 때 "이동한" 으로 정정.

## 요약

이번 PR 의 plan 라이프사이클 게이트 신설(status 종료값 강제 + 살아있는 plan 링크 무결성)은
실측 기반 스코프 조정(예: `plan/complete/**` 링크 135건은 정상으로 면제, `implemented`/
`applied`/`superseded` 는 눕히지 않고 보존)이 꼼꼼하고, 15건의 status 정정·9건의 링크 정정
모두 실제 파일 존재를 재확인한 결과 기능적으로 깨진 참조는 없다(가드 자체도 현재 0 violation
로 green). 진행 중 plan 들과의 "미해결 결정 우회" 나 "선행 plan 미해소" 류 충돌은 발견되지
않았다. 다만 (1) ai-review 후속 2건을 주제가 다른 plan(`harness-env-value-subpattern-dedup.md`)
에 이관 등재해 발견성이 떨어지는 점, (2) "깨진 링크가 전부 같은 실패 클래스" 라는 서술이
가드의 실제 스캔 메커니즘(코드펜스 스킵)과 어긋나는 세부 불일치가 남아 있다는 점을 WARNING
으로 남긴다. 둘 다 차단 사유는 아니며 문서 정확도·발견성 개선 권고 수준이다. 리뷰 수행 중
워킹트리가 계속 갱신돼(동일 세션의 다른 checker 가 지적했을 법한 naming/서술 이슈 일부가
실시간으로 고쳐지는 것을 관측함) 위 두 건 중 일부는 이미 부분적으로 반영되는 과정에 있었다.

## 위험도

LOW
