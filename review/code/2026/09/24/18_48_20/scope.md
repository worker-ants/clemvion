# 변경 범위(Scope) 리뷰 — `deps-typeorm12` (2라운드, 18_48_20)

## 검토 범위

`git diff --stat origin/main..HEAD` 로 실제 diff 전체(32 파일, 1635 insertions / 22 deletions)를
확인했다. 실질 코드/설정 변경은 4개 파일뿐이고 나머지 28개는 1라운드 리뷰(`review/code/.../18_22_23/**`,
8개+JSON) 와 그 선행 impl-prep consistency-check(`review/consistency/.../17_31_27/**`, 5개+JSON) 산출물이다.

| 파일 | 순변경 | 분류 |
| --- | --- | --- |
| `codebase/backend/package.json` | 1줄 | 의도된 핵심 변경(`@nestjs/typeorm` `^11.0.3`→`^12.0.1`) |
| `pnpm-lock.yaml` | 15줄 | 위 범프의 lockfile 반영 |
| `PROJECT.md` | 1줄(교체) | 1라운드 W3 조치 — 이 범프가 만드는 암묵적 결속(ESM-only `require(esm)`) 문서화 |
| `plan/in-progress/deps-typeorm12.md` | 신규 123줄 | 이 작업의 plan 문서(신규 작업이므로 필수) |
| `plan/in-progress/nestjs-v12-coordinated-upgrade.md` | +108/-22 | 형제 plan — 전면 12 업그레이드 시도·롤백 기록(아래 참고) |
| `plan/in-progress/spec-draft-nullable-notation-followups.md` | +28 | 이번 작업 중 발견한 lockfile `libc:` 진동 후속 항목 등재 |
| `review/code/.../18_22_23/**` (13파일) | +719 | 1라운드 code-review 산출물 커밋 |
| `review/consistency/.../17_31_27/**` (7파일) | +414 | 선행 impl-prep consistency-check 산출물 커밋 |

## 발견사항

- **[INFO]** diff 의 절대다수(1635줄 중 ~1130줄)가 실행 코드가 아니라 **두 차례 리뷰 세션의 산출물을 그대로 커밋**한 것이다.
  - 위치: `review/code/2026/09/24/18_22_23/*`, `review/consistency/2026/09/24/17_31_27/*` (파일 전체가 신규 추가라 diff 게이트가 전부 `+`)
  - 상세: 이 저장소 컨벤션(`CLAUDE.md` "정보 저장 위치" 표, `code-review-agents`/`consistency-checker` SKILL)은 리뷰·일관성 검토 산출물을 `review/code/**`·`review/consistency/**` 에 커밋하는 것을 표준 워크플로로 규정한다. 따라서 이는 스코프 이탈이 아니라 절차상 요구되는 문서화다 — 실제로 1라운드 자신의 `scope.md`(파일 20)도 동일한 결론을 냈다("코드 변경 범위 밖의 임의 추가가 아니다"). 다만 diff 크기의 대부분을 차지해 리뷰어가 실질 코드 변경(4개 파일, 순 17줄)을 놓치기 쉬우므로 기록해 둔다.
  - 제안: 조치 불요. 참고용 기록.

- **[INFO]** `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 가 이번 라운드에서 대폭(+108/-22) 재작성됐는데, 그 내용(§0 "세 벽" 실측 — `@nestjs-modules/mailer`·`@nestjs/throttler` 타이핑 미대응, TS major 요구)은 **이 PR 자신이 하지 않기로 한 전면 12 업그레이드**에 대한 것이다.
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §0("왜 멈췄나 — 세 벽"), §3("재개 조건")
  - 상세: 코드 변경은 전혀 없고(diff 는 이 문서 자체와 `deps-typeorm12.md` 뿐), 내용도 "왜 `@nestjs/typeorm` 만 분리해 좁혔는가"를 뒷받침하는 근거이므로 실질적으로는 이 PR 의 스코프 결정을 정당화하는 자료다. `deps-typeorm12.md` §D 도 "세 벽의 실측은 `nestjs-v12-coordinated-upgrade.md` §0 에 옮겨 적었다"고 명시해 의도적 분리임을 밝히고 있다. 다만 이 문서가 다루는 대상(mailer/throttler/TS6) 자체는 이번 changeset 의 실제 코드 변경과는 직접 접점이 없는 별도 트랙 작업이라, 순수하게 "이 PR 의 변경 범위"만 놓고 보면 부가 정보에 해당한다.
  - 제안: 조치 불요 — plan 문서 간 의도된 역할 분리이며 코드 스코프 이탈이 아니다.

- **[INFO]** 1라운드에서 Warning 으로 지적된 `pnpm-lock.yaml` 무관 변경(optional 네이티브 패키지 `libc:` 필드 63줄 삭제 + `eslint-plugin-import` peer 문자열 교환)이 이번 라운드 diff 에서는 완전히 사라졌다 — 이번 `pnpm-lock.yaml` 변경은 3개 hunk, 15줄 모두 `@nestjs/typeorm` 관련(importer specifier/version, packages resolution/peerDependencies/engines, snapshot 키)뿐임을 실측 확인(`git diff --stat` 상 `pnpm-lock.yaml | 15 +--`).
  - 위치: `pnpm-lock.yaml`
  - 상세: 이는 결함이 아니라 1라운드 Warning 1 의 정정 확인이다 — 좋은 방향으로만 스코프가 좁아졌다.
  - 제안: 없음(긍정 확인).

## 요약

실질 코드/설정 변경은 `codebase/backend/package.json` 한 줄(`@nestjs/typeorm` 범프)과 그에 정확히 대응하는 `pnpm-lock.yaml` 15줄, 그리고 1라운드 Warning 조치로서의 `PROJECT.md` 한 줄 문서화로 국한되어 있다. 1라운드에서 지적됐던 lockfile 무관 변경(W1)은 실측상 완전히 제거됐다. diff 의 대부분(약 1130줄)은 리뷰·일관성 검토 산출물을 표준 위치에 커밋한 것으로, 이 저장소 컨벤션상 요구되는 절차이며 스코프 이탈이 아니다. `nestjs-v12-coordinated-upgrade.md` 의 대폭 갱신도 코드 변경 없이 "왜 전면 업그레이드 대신 typeorm 만 분리했는가"를 뒷받침하는 의도된 자료여서 스코프 이탈로 보지 않는다. 불필요한 리팩토링·기능 확장·무관한 임포트/포맷팅/주석 변경은 관찰되지 않았다.

## 위험도
NONE
