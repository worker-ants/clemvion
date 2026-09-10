# 문서화(Documentation) 코드 리뷰

## 검토 범위

- `CHANGELOG.md` — 신규 "Unreleased" 항목 (audit 25건 → 0건 조치 기록)
- `codebase/backend/package.json`, `codebase/channel-web-chat/package.json`, `codebase/frontend/package.json` — 직접 의존 4건 상향
- `plan/in-progress/deps-audit-floor-refresh-2026-09.md` — 신규 plan 문서
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` — override 바닥 상향 8건 + 신설 1건(`qs`)
- `scripts/check-pnpm-security-config.py` — `EXPECTED_OVERRIDES` baseline 동반 갱신

## 실측 검증 (문서 주장 vs 실행 결과)

CHANGELOG·plan 문서에 적힌 검증 수치를 직접 재실행해 대조했다 (이 워크트리 = `origin/main` 기준):

| 문서의 주장 | 실행 명령 | 실측 결과 | 일치 |
| --- | --- | --- | --- |
| `pnpm audit --audit-level=moderate` → exit 0, No known vulnerabilities | 동일 명령 실행 | `No known vulnerabilities found` | ✅ |
| `check-override-floors.py` → override 대상 30개 패키지, 재유입 0건 | 동일 스크립트 실행 | `OK: override 대상 30개 패키지 중 취약 재유입 0건` | ✅ |
| `check-pnpm-security-config.py` → overrides 33건 값까지 baseline 일치 | `EXPECTED_OVERRIDES` dict 키 수 계산 | 33건 | ✅ |
| `check-unmet-peers.py` → 미충족 peer 2건(기존 수용 항목) | 동일 스크립트 실행 | `nunjucks→chokidar`, `typeorm→ioredis` 2건, 신규 0건 | ✅ |
| CHANGELOG "조치" 개수: 바닥 8건 · 신설 1건 · 직접 의존 4건 | diff 의 override/직접 의존 변경 라인 수 대조 | override 8행(`fast-uri`·`hono`·`multer`·`nodemailer`·`sharp`·`svgo`·`js-yaml`×2), 신설 `qs` 1건, 직접 의존 4건(csv-parse·nodemailer·next×2) | ✅ |

CHANGELOG·plan·package.json·pnpm-workspace.yaml·check-pnpm-security-config.py 5개 파일에 흩어진 버전 숫자(예: `nodemailer ^9.0.5→^9.1.1`, `js-yaml` 키+값 동시 상향)를 상호 대조했고 불일치를 찾지 못했다. dependabot 드리프트 방지 관례(PROJECT.md §의존성 취약점 audit·핀 거버넌스 "2-place 편집")도 지켜졌다 — `pnpm-workspace.yaml` overrides 변경과 `check-pnpm-security-config.py` `EXPECTED_OVERRIDES` 가 같은 diff 안에서 동반 갱신됐다.

## 발견사항

- **[INFO]** `pnpm-workspace.yaml` 의 override 헤더 주석 관례(각 항목 CVE 근거는 "그 값을 올린 커밋 메시지에 있다")를 이번 PR 도 따른다 — `qs` 신설과 `js-yaml` 키 확장(스코프 override 함정)에는 인라인 주석을 붙였지만, `fast-uri`·`hono`·`multer`·`nodemailer`·`sharp`·`svgo` 6건은 값만 바뀌고 인라인 근거 주석이 없다.
  - 위치: `pnpm-workspace.yaml` (기존 코드 컨텍스트 게이트 40~54번 줄 — `fast-uri: ^3.1.6` / `hono: ^4.13.5` / `multer: ^2.3.0` / `nodemailer: ^9.1.1` / `svgo: ^4.1.0` / `sharp: ^0.35.4`)
  - 상세: 이 저장소는 이미 "단일 커밋 해시를 주석에 고정하는 방식은 틀렸다"(파일 상단, 2026-08-07 정정 이력)고 명시적으로 결론 낸 바 있어, 값만 바뀌는 일반 케이스에는 인라인 주석을 안 붙이는 것이 **의도된 기존 관례**다. 따라서 이건 새로 생긴 결함이 아니라 기존 설계 결정을 그대로 따른 것 — CRITICAL/WARNING 대상이 아니라 참고용 INFO로만 남긴다.
  - 제안: 조치 불필요. (커밋 메시지 자체가 근거 소스이므로, PR 병합 시 커밋 메시지에 CVE 매핑이 포함되는지만 확인하면 충분.)

- **[INFO]** `plan/in-progress/deps-audit-floor-refresh-2026-09.md` 의 체크리스트 마지막 두 항목(`/ai-review` SUMMARY, dependabot PR 7건 rebase 요청)이 미완료(`[ ]`) 상태로 남아 있다.
  - 위치: `plan/in-progress/deps-audit-floor-refresh-2026-09.md` (게이트 117~118번 줄)
  - 상세: `status: in-progress` 와 정확히 일치하는 정상 상태이며 문서 결함이 아니다 — 이 리뷰(`/ai-review`) 자체가 그 체크리스트 항목을 충족시키는 절차 중 하나이므로, 이 리뷰의 SUMMARY 처리 후 plan 체크박스·`complete/` 이동 여부를 다음 커밋에서 갱신해야 한다는 점만 상기.
  - 제안: 조치 불필요(작업 진행 중 정상 상태). 후속 커밋에서 체크리스트 동기화만 확인.

- **[INFO]** 검토 중 `pnpm-lock.yaml` 이 일시적으로 삭제된 상태(`git status --short` → ` D pnpm-lock.yaml`)를 관측했으나, 직후 재확인 시 파일이 정상 존재하고 `git status` 가 clean 이었다.
  - 위치: 저장소 루트 `pnpm-lock.yaml` (파일 경로만, 특정 줄 아님)
  - 상세: 이 리뷰는 병렬 fan-out 이며 동시에 다른 reviewer 가 같은 워킹트리를 읽고 있다는 사전 경고가 있었다 — 관측된 일시적 삭제는 다른 reviewer 의 mutation-then-restore 사이클을 우연히 관측한 것으로 추정된다. **본 reviewer 는 저장소에 어떤 파일도 쓰거나 고치지 않았다**(`git checkout`/`restore`/`stash` 등 일체 미사용). 최종 확인 시점 기준 `git status --short` 는 미추적 리뷰 산출물 디렉터리(`review/code/2026/09/10/20_17_59/`) 외에는 clean 하다.
  - 제안: 통합 SUMMARY 작성자는 이 리뷰가 끝난 시점의 `git status`(본 보고서 작성 완료 시점)를 한 번 더 확인해 다른 reviewer 의 미복원 잔여물이 없는지 재확인 권장.

## 요약

이 PR 은 문서화 관점에서 모범적이다. CHANGELOG 항목은 문제 배경(경로 필터가 main 의 red 상태를 가려온 이유)·조치 근거(GHSA ID·override 스코프 함정 설명)·검증 명령과 실측 결과를 모두 갖췄고, 별도 `plan/in-progress/` 문서가 frontmatter 스키마(worktree/started/owner)를 정확히 채운 채 동일 내용을 더 상세히 추적한다. 직접 재실행으로 대조한 5개 정량 주장(`pnpm audit`, `check-override-floors.py`, `check-pnpm-security-config.py` override 개수, `check-unmet-peers.py`, 조치 건수 8+1+4)이 전부 실측과 일치해 "문서가 구현보다 넓게 말하는" 유형의 결함이 없음을 확인했다. `pnpm-workspace.yaml` 의 override 인라인 주석(js-yaml 스코프 함정·`qs` 프로덕션 경로 근거)도 이 저장소가 이미 정립한 관례(단일 커밋 해시 고정 금지, 함정이 있는 항목만 주석)를 그대로 따른다. API 문서·README·환경변수 문서·예제 코드는 이번 변경의 성격(의존성 버전 상향)상 영향받지 않아 갱신 불필요로 판단된다. CRITICAL/WARNING 수준 결함은 발견되지 않았다.

## 위험도

NONE
