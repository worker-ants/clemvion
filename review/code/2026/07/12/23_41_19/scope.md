# 변경 범위(Scope) Review

대상 diff (`git diff origin/main --stat`, 16 files / 554+ / 6-): `codebase/backend/Dockerfile`, `plan/in-progress/pnpm-migration-followups.md`, `review/code/2026/07/12/23_21_17/*` (신규 14개 리뷰 산출물 + RESOLUTION.md + SUMMARY.md).

## 발견사항

- **[INFO]** plan 문서에 1차 스코프(§1 devDeps 제거)와 무관한 §2(swagger 핀 제거 조사) 메모가 같은 diff 에 포함
  - 위치: `plan/in-progress/pnpm-migration-followups.md` — `## 2. @nestjs/swagger 11.2.7 핀 제거...` 아래 `**조사(2026-07-12, defer)**` 단락
  - 상세: 이번 diff 의 실제 코드 변경은 `codebase/backend/Dockerfile` 의 §1(devDeps prune, `prod-deps` 스테이지) 뿐인데, 별개 backlog 항목인 §2(swagger 버전 핀) 실측 조사·defer 사유가 같은 커밋들(`6053ff281`/`f53765bfb`)에 함께 기록됐다. 코드 변경 없이 문서 기록만 추가된 것이라 실질 영향은 없음. 이 항목은 직전 리뷰 라운드(23_21_17)의 scope 리뷰에서도 동일하게 INFO 로 지적됐고, `pnpm-migration-followups.md` 자체가 §1~§4 를 모두 포괄하는 backlog 문서이며 프로젝트가 이미 채택한 "같은 plan 파일에 관련 defer 결정을 함께 기록"하는 관례와 일치한다는 판단이 유지된다.
  - 제안: 조치 불요(기존 판정 유지). 향후 §2 를 실제로 구현하는 별도 PR 착수 시 이 조사 기록을 재사용하면 됨.

- **[INFO]** `review/code/2026/07/12/23_21_17/**` 신규 14개 파일(SUMMARY/RESOLUTION/서브에이전트 리포트/meta.json/_retry_state.json)은 코드 변경이 아니라 이전 ai-review 라운드의 산출물 커밋
  - 상세: CLAUDE.md 정보 저장 위치 표에 따라 코드 리뷰 산출물은 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`에 커밋되는 것이 정식 관례이며, 이번 diff 는 그 규약을 정확히 따른다. 이 파일들 자체가 "무관한 파일 추가"로 보일 수 있으나, 실제로는 §1 구현(devDeps 제거)에 대한 리뷰 사이클(라운드 1: 23_21_17 → RESOLUTION → Dockerfile 주석 정밀화 → 이번 라운드 23_41_19)의 정상적인 부산물이다. 스코프 이탈 아님.
  - 제안: 없음.

- 그 외 항목은 스코프 이탈 없음:
  - `codebase/backend/Dockerfile` diff 는 plan §1 "옵션 B 변형"(전용 `prod-deps` 스테이지 신설 + `runner` 의 `COPY --from` 소스 교체)만 구현. `deps`/`builder` 스테이지, `.npmrc`, `docker-compose*.yml`, CI 워크플로 등 무관 영역은 손대지 않음(`git diff origin/main --stat` 상 파일 목록에도 없음).
  - `runner` 주석 변경은 `COPY --from=builder` → `COPY --from=prod-deps` 로 바뀐 실제 동작을 설명하는 필수 갱신이며, `prod-deps` 스테이지 주석은 직전 라운드 리뷰(I2: "prepare(tsc) 재실행" 과장 지적)에 대한 정밀화 수정 — 요청된 fix 범위와 정확히 일치.
  - `pnpm-migration-followups.md` frontmatter(`worktree`, `owner`) 갱신은 워크트리 시작 시 표준 bookkeeping(`ensure-worktree.sh` 관례)이며 임의 변경 아님. §1 완료 노트 + "스코프 정직화" 인용문은 실제 ai-review W1 WARNING 처리 결과(main 실측 재검증)를 그대로 반영 — 코드 변경과 1:1 대응.
  - 포맷팅 전용 변경, 미사용 임포트, 무관 설정 파일(package.json/pnpm-lock.yaml/CI yml 등) 변경은 발견되지 않음.
  - 불필요한 리팩토링·기능 확장(over-engineering) 없음 — `prod-deps` 스테이지는 plan 에 사전 명시된 옵션 B 를 그대로 구현한 것으로 신규 아이디어의 임의 추가가 아님.

## 요약

이번 diff 는 plan §1(backend 프로덕션 이미지 devDeps 제거)의 사전 계획된 구현(`prod-deps` 스테이지 신설)과 그 검증 근거·직전 ai-review 라운드 산출물 커밋으로 구성되며, 요청 범위를 벗어난 리팩토링·기능 확장·무관 파일 수정·포맷팅 뒤섞임·임포트/설정 변경은 없다. 유일하게 언급할 점은 plan 문서에 §1 과 무관한 §2(swagger 핀) 조사 메모가 동봉된 것인데, 이는 코드 변경이 아니고 프로젝트가 채택한 backlog 문서 내 관련 결정 병기 관례와 일치하며 직전 라운드에서도 동일하게 비차단으로 판정된 사안이다. `review/code/**` 신규 파일들은 CLAUDE.md 가 명시한 리뷰 산출물 커밋 관례를 따르는 정상 부산물이다.

## 위험도

NONE
