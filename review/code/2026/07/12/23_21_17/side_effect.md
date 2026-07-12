# 부작용(Side Effect) 리뷰 결과

## 리뷰 대상
- `codebase/backend/Dockerfile` — `prod-deps` 신규 스테이지 추가, `runner` 의 COPY 소스를 `builder` → `prod-deps` 로 변경
- `plan/in-progress/pnpm-migration-followups.md` — frontmatter(worktree/owner) 및 완료/조사 노트 추가 (문서 전용)

## 발견사항

- **[INFO]** 프로덕션 이미지 아티팩트(인터페이스) 변경 — devDependencies 제거
  - 위치: `codebase/backend/Dockerfile` L56-57 (`COPY --from=builder` → `COPY --from=prod-deps`)
  - 상세: `runner` 가 최종적으로 담는 `/app` 콘텐츠가 바뀐다 — 기존에는 `builder` 산출물(devDeps 포함 node_modules)을 통째로 옮겼으나, 이제는 `prod-deps`(devDeps prune 완료)를 옮긴다. 애플리케이션 코드 관점에서는 함수 시그니처·공개 API 변경이 아니지만, **컨테이너라는 "산출물 인터페이스"** 는 명확히 변경된다. `docker exec` 로 컨테이너에 들어가 devDependency 기반 도구(예: 임시 디버깅 스크립트, `ts-node` 등)를 실행하던 운영 관행이 있었다면 이 변경 이후 실패한다.
  - 검증 근거: 저장소 내 `docker exec`/`ts-node`/`nodemon` 등을 prod 컨테이너에서 실행하는 스크립트·워크플로는 grep 결과 발견되지 않음. `docker-compose.yml` 의 dev `backend` 서비스는 `target: deps` 를 명시해 이번 변경(builder 이후 스테이지)의 영향을 받지 않고, `docker-compose.e2e.yml` 의 `backend-e2e` 는 `target: runner` 로 새 경로를 그대로 통과했고 plan 문서에 "e2e(253) 무회귀" 로 기록되어 있어 실측 검증이 이미 이루어짐.
  - 제안: 별도 조치 불필요(이미 의도된 변경이자 검증 완료). 다만 향후 운영 런북에 "prod 컨테이너에는 devDeps 가 없다"는 전제를 반영해 둘 것.

- **[INFO]** 빌드타임 네트워크 호출 중복
  - 위치: `codebase/backend/Dockerfile` L41-43 (`prod-deps` 스테이지의 `pnpm install --prod --frozen-lockfile --filter "backend..."`)
  - 상세: 기존에는 `deps` 스테이지에서 1회 `pnpm install`(레지스트리 접근 가능)만 수행했으나, 이제 `prod-deps` 스테이지에서 `--prod` 재해소를 위해 사실상 동일한 의존성 그래프를 다시 install 한다. pnpm 스토어 캐시가 없다면 레지스트리 fetch 가 두 번 발생해 빌드 시간이 늘어날 수 있다. 이는 "의도하지 않은 외부 서비스 호출" 이라기보다 이미지 크기 최적화를 위해 감수한 트레이드오프이며, 빌드 로직·CI 파이프라인의 정합성에 영향을 주지 않는다.
  - 제안: 조치 불필요. BuildKit 레이어/스토어 캐시가 있으면 실질 네트워크 재호출은 최소화됨.

- **[INFO]** `CI=true` 는 빌드 스테이지 로컬 스코프로 올바르게 격리됨
  - 위치: `codebase/backend/Dockerfile` L43 (`RUN CI=true pnpm install ...`)
  - 상세: `CI=true` 가 `ENV` 지시자가 아닌 `RUN` 인라인 prefix 로 지정되어 있어 해당 RUN 레이어에만 적용되고 최종 `runner` 이미지의 런타임 환경변수로 전파되지 않는다. 일부 라이브러리는 `process.env.CI` 를 참조해 동작을 분기하므로(spinner/색상 출력 억제 등), 만약 `ENV CI=true` 형태로 지정했다면 런타임에도 그 분기가 발동해 예기치 않은 부작용이 될 뻔했다. 이번 diff 는 그 함정을 피하고 있음을 확인.
  - 제안: 없음 (문제 없음, 확인 목적으로 기록).

- **[INFO]** `pnpm install --prod` 로 인한 node_modules 재구성이 내부 workspace 패키지 `prepare` 를 재트리거할 가능성
  - 위치: `codebase/backend/Dockerfile` L37-40 주석, 및 `codebase/packages/*/package.json` 의 `"prepare": "[ -d dist ] || tsc"`
  - 상세: 주석은 "native(bcrypt/isolated-vm) 와 내부 패키지 prepare(tsc)를 재실행해야 한다" 고 서술하나, 각 내부 패키지의 `prepare` 스크립트는 `[ -d dist ] || tsc` (또는 sdk 의 fs.existsSync 동치 구현)로 **`dist` 가 이미 존재하면 tsc 를 skip** 한다. workspace 패키지는 pnpm 이 `codebase/packages/*` 소스 디렉터리를 심링크하므로, node_modules 재해소로 심링크 자체는 재생성되어도 가리키는 소스 디렉터리의 `dist` 는 그대로 남아 재컴파일이 실제로는 발생하지 않을 가능성이 높다. 즉 "재실행" 이라는 주석 표현이 다소 과장이지만, 실행 결과(정상 스킵)는 안전한 방향이라 기능적 부작용은 없다. `bcrypt`/`isolated-vm` 같은 네이티브 애드온만 실제로 노드 버전/플랫폼 재바인딩이 필요해 재빌드되며, 이를 위한 `python3 make g++` 툴체인은 `deps`→`builder`→`prod-deps` 레이어 체인을 통해 상속되어 실제로 사용 가능함을 확인.
  - 제안: 조치 불필요. 주석 문구를 "실제로는 dist 존재 시 스킵되어 재빌드는 거의 발생하지 않는다"로 다듬으면 더 정확하나 선택 사항.

- **[NONE]** `plan/in-progress/pnpm-migration-followups.md` 변경은 문서/메타데이터(frontmatter, 완료 노트)뿐이며 코드 실행 경로·전역 상태·파일시스템·네트워크·이벤트에 영향 없음.

## 요약
이번 변경은 함수 시그니처나 코드 레벨 공개 API 를 건드리지 않는 순수 인프라(Dockerfile 멀티스테이지 추가)와 문서 갱신이다. 유일하게 실질적인 "인터페이스 변화"는 최종 prod 이미지에서 devDependencies 가 제거된다는 점인데, 이는 plan 문서에 명시된 의도된 목표이고 e2e(253) 무회귀 + 이미지 크기 감소로 실측 검증까지 완료되었다. `CI=true` 스코핑이 런타임으로 새지 않도록 올바르게 처리되어 있고, 저장소 내에서 prod 컨테이너에 devDeps 존재를 전제하는 운영 스크립트도 발견되지 않아 하위 호환성 리스크는 낮다. 다만 devDeps 제거가 "docker exec 기반 임시 디버깅" 같은 비-코드 운영 관행에 영향을 줄 수 있다는 점은 운영 인지 차원에서 기록해 둘 가치가 있다.

## 위험도
LOW
