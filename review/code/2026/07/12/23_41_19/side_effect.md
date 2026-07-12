# 부작용(Side Effect) 리뷰 결과

## 리뷰 대상
- `codebase/backend/Dockerfile` — `origin/main` 대비 누적 diff(기능 커밋 `6053ff281` + 이번 라운드 커밋 `f53765bfb`). `git show f53765bfb -- codebase/backend/Dockerfile` 로 직접 확인한 결과 이번 라운드 자체는 **주석 문구 정정뿐**(로직 무변경) — `prod-deps` 스테이지 신설·`COPY --from=builder`→`COPY --from=prod-deps` 전환은 이전 커밋(`6053ff281`, 라운드 `23_21_17`)에서 이미 반영·리뷰됨.
- `plan/in-progress/pnpm-migration-followups.md` — frontmatter(worktree/owner) + 완료·조사 노트 추가(문서 전용).
- `review/code/2026/07/12/23_21_17/*`(RESOLUTION.md·SUMMARY.md·_retry_state.json·meta.json·12개 리뷰어 산출물) — 신규 파일 생성.

## 발견사항

- **[INFO]** 이번 라운드의 실제 diff(커밋 `f53765bfb`)는 Dockerfile 주석 문구 정정 + plan 문서 텍스트뿐, 로직 변경 없음
  - 위치: `codebase/backend/Dockerfile:39-43` 주석
  - 상세: `git show f53765bfb -- codebase/backend/Dockerfile` 로 직접 대조한 결과 변경분은 "내부 패키지 prepare 는 `[ -d dist ] || tsc` 가드라 dist 존재 시 tsc 스킵" 문구 추가뿐이며, `FROM builder AS prod-deps` / `COPY --from=prod-deps` 등 실행 경로에 영향을 주는 지시자는 이전 커밋과 동일하다. RESOLUTION.md 의 "Dockerfile 변경은 주석 전용(로직 무변경)" 주장과 실측이 일치한다.
  - 제안: 없음(검증 완료).

- **[INFO]** 프로덕션 이미지 산출물("컨테이너 인터페이스") 변경 — devDependencies 제거는 이전 라운드에 이미 검증된 항목, 재확인 결과 동일
  - 위치: `codebase/backend/Dockerfile` (`FROM builder AS prod-deps` 스테이지, `COPY --from=prod-deps --chown=node:node /app ./`)
  - 상세: `runner` 최종 이미지의 `/app` 콘텐츠가 devDeps 제거된 `prod-deps` 산출물로 바뀐다. `docker exec` 로 컨테이너에 들어가 devDependency 기반 도구(ts-node/nodemon 등)를 실행하는 운영 스크립트가 있다면 영향을 받을 수 있으나, repo 전체 grep 결과 그런 사용처는 없음을 재확인했다. `docker-compose.yml` 의 dev `backend` 서비스는 `target: deps` 로 이 변경 대상 스테이지 이전이라 무관하고, `docker-compose.e2e.yml` 의 `backend-e2e` 는 `target: runner` 로 변경된 경로를 그대로 통과하며 plan 문서에 "e2e(253) 무회귀" 로 검증 기록이 남아 있다.
  - 제안: 조치 불필요(이미 의도된 변경 + 검증 완료). 이전 라운드 side_effect 리뷰(`review/code/2026/07/12/23_21_17/side_effect.md`)의 동일 결론과 일치.

- **[INFO]** `CI=true` 는 `RUN` 인라인 스코프로 격리되어 런타임(`runner`)으로 전파되지 않음 — 확인 유지
  - 위치: `codebase/backend/Dockerfile:44` (`RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`)
  - 상세: `ENV` 지시자가 아니므로 해당 `RUN` 레이어에만 적용된다. `process.env.CI` 를 참조해 동작을 분기하는 런타임 코드가 있었다면 예기치 않은 부작용이 될 뻔했으나, 스코핑이 올바르다.
  - 제안: 없음.

- **[INFO]** 신규 review 산출물 파일 생성(`review/code/2026/07/12/23_21_17/*` 12개 + RESOLUTION.md/SUMMARY.md/_retry_state.json/meta.json)은 프로젝트 컨벤션상 의도된 파일시스템 부작용
  - 위치: `review/code/2026/07/12/23_21_17/` 하위 신규 파일 전체
  - 상세: `review/` 는 gitignore 대상이 아니며 SUMMARY·RESOLUTION 을 포함해 커밋하는 것이 프로젝트 표준 관례다. 애플리케이션 코드나 런타임 동작에 영향이 없는 순수 기록성 파일이다.
  - 제안: 없음(의도된 동작).

- **[INFO]** `review/code/2026/07/12/23_21_17/_retry_state.json` · `meta.json` 이 "진행 중" 스냅샷 상태로 동결되어 커밋됨
  - 위치: `_retry_state.json` — `"routing_status": "pending"`, `"agents_success": []`, `"agents_pending": [...]` (14개 전부)
  - 상세: 실제로는 해당 라운드가 SUMMARY.md·RESOLUTION.md 존재로 보아 완료되었으나, 오케스트레이터 내부 상태 파일은 최초 실행 시점(라우팅 직후)의 스냅샷을 그대로 담고 있다. 코드 실행 경로에는 영향이 없으나, 만약 향후 다른 자동화가 `_retry_state.json` 을 "재시도 대상 판별" 용도로 재사용한다면 이미 종료된 세션을 "pending" 으로 오판할 잠재 여지가 있다(현재 그런 소비 로직은 발견되지 않음).
  - 제안: 조치 불요(정보성). 향후 세션 상태 파일 재사용 로직을 도입할 경우 종료 시점 상태 갱신 여부를 함께 검토.

- **[NONE]** `plan/in-progress/pnpm-migration-followups.md` 변경은 문서/메타데이터(frontmatter, 완료·조사 노트)뿐이며 코드 실행 경로·전역 상태·파일시스템·네트워크·이벤트에 영향 없음.

## 요약

이번 라운드에서 실제로 커밋된 변경(`f53765bfb`)은 Dockerfile 주석 문구 정정과 plan 문서 텍스트뿐으로, `git show` 로 직접 대조한 결과 로직·실행 경로 변경은 전혀 없다. `origin/main` 기준 누적 diff 에 포함된 `prod-deps` 스테이지 신설·COPY 소스 전환은 이전 라운드(`23_21_17`)에서 이미 검증된 항목이며, 이번 재확인에서도 `docker-compose.e2e.yml`(target: runner)·`docker-compose.yml`(target: deps) 참조가 안전하게 유지되고 `CI=true` 스코핑도 런타임으로 새지 않음을 재확인했다. `docker exec` 기반 devDeps 의존 운영 스크립트도 repo 내 발견되지 않는다. 함수 시그니처·공개 API·전역 상태·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 어느 관점에서도 의도치 않은 부작용은 없다. 신규 생성된 `review/code/2026/07/12/23_21_17/*` 산출물 파일들은 프로젝트 컨벤션(리뷰 산출물 커밋)에 따른 의도된 파일시스템 기록이며, `_retry_state.json`/`meta.json` 이 완료 후에도 "pending" 스냅샷으로 동결돼 있는 점만 향후 재사용 시 유의할 정보성 사항으로 남긴다.

## 위험도

LOW
