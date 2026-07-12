# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `prod-deps` 스테이지가 `USER node` 지정 전(즉 root)으로 `pnpm install --prod` 실행
  - 위치: `codebase/backend/Dockerfile:47-49` (`FROM builder AS prod-deps` / `RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`)
  - 상세: 해당 RUN 은 중간 빌드 레이어에서 root 권한으로 수행되지만, 런타임에 노출되는 것은 최종 `runner` 스테이지뿐이다. `runner` 는 `COPY --from=prod-deps --chown=node:node /app ./` 로 소유권을 `node` 로 교정한 뒤 `USER node` 로 전환하므로(현재 파일 확인 결과 `USER node` 는 여전히 `runner` 스테이지 마지막에 유지) 실행 컨테이너는 non-root 로 구동된다. 멀티스테이지 빌드의 통상 패턴이며 이번 diff 로 인한 회귀 아님(직전 라운드 23_21_17 security 리뷰에서도 동일 판정, 이번엔 주석만 정밀화됨).
  - 제안: 조치 불요.

- **[INFO]** `CI=true pnpm install --prod --frozen-lockfile` — 공급망 무결성 영향 없음
  - 위치: `codebase/backend/Dockerfile:49`
  - 상세: `CI=true` 는 pnpm 의 비대화형 삭제/재구성 확인 프롬프트를 넘기기 위한 것으로, `onlyBuiltDependencies` 허용 목록(`bcrypt`/`isolated-vm`/`esbuild` 등, root `package.json`)에 이미 등재된 패키지의 native build 및 내부 워크스페이스 `prepare` 재실행만 트리거한다. pnpm 은 허용 목록 밖 패키지의 설치 스크립트를 기본적으로 skip 하므로 `CI=true` 가 임의 서드파티 postinstall 을 새로 승인하지 않는다. `--frozen-lockfile` 이 `deps`·`prod-deps` 두 스테이지 모두에 유지되어 `pnpm-lock.yaml` 변조·드리프트도 차단된다.
  - 제안: 조치 불요.

- **[INFO]** devDependencies 제거는 공격 표면 축소(개선) — 신규 취약점 도입 없음
  - 위치: `codebase/backend/Dockerfile` 전체 diff
  - 상세: 이번 변경은 프로덕션 런타임 이미지에서 jest/eslint/ts-jest 등 devDependencies 를 제거해 이미지 크기(1.4GB→1.23GB)와 잠재 공격 표면을 줄인다. `package.json`/`pnpm-lock.yaml` 자체는 변경되지 않아(diff 대상 아님) 버전 고정·`pnpm.overrides` 핀도 그대로 유지된다.
  - 제안: 조치 불요.

- **[INFO]** `@nestjs/swagger` 11.2.7 버전 핀 — 기존 리스크, 이번 diff 범위 밖(재확인)
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §2 (`@nestjs/swagger 11.2.7 핀 제거 + deep-import 정리`)의 신규 조사 기록 문단
  - 상세: 이번 diff 는 이 핀을 도입하지도, 해소하지도 않는다 — 단지 "왜 아직 제거하지 못했는지"(SchemaObject 미공개 export, openapi3-ts 미의존)에 대한 조사 결과를 문서화하고 별도 focused PR 로 defer 하기로 재확인한 것이다. `pnpm.overrides["@nestjs/swagger"]` 핀이 11.4.x 이상의 보안 패치 적용을 계속 차단하는 상태는 변화 없이 남아 있으며, 문서 자체도 "보안 측면에서 우선순위 있음" 이라 명시해 인지하고 있다. 신규 devDependency(`openapi3-ts`) 도 실제 추가되지 않았고(조사 기록일 뿐), 라이선스(MIT)·타입 전용 특성상 도입 시에도 런타임 리스크는 낮다.
  - 제안: 별도 PR 착수 시 11.2.7 → 11.4.x changelog 의 CVE/보안 수정 여부를 우선 확인해 우선순위를 정할 것(문서에 이미 계획됨). 이번 PR 을 이 사유로 차단할 필요는 없음.

- **[INFO]** review 산출물(SUMMARY/RESOLUTION/*.md/_retry_state.json/meta.json) 자체는 순수 감사 기록 — 보안 이슈 없음
  - 위치: `review/code/2026/07/12/23_21_17/*`
  - 상세: 신규 파일들은 이전 라운드(23_21_17)의 리뷰 산출물을 커밋에 포함시킨 것으로, 시크릿·자격증명·엔드포인트 등 민감정보 노출 없음(수치·설계 근거·검증 로그만 포함). `_retry_state.json` 은 로컬 절대경로(`/Volumes/project/private/...`)를 담고 있으나 이는 개발자 로컬 워크트리 경로로 시크릿이 아니며 리포지토리 관례(다른 리뷰 세션도 동일 패턴)와 일치한다.
  - 제안: 조치 불요.

## 요약

이번 변경은 `codebase/backend/Dockerfile` 에 이미 도입된 `prod-deps` 스테이지의 주석을 정밀화(`prepare`(tsc) 스킵 조건 명시)하고, `plan/in-progress/pnpm-migration-followups.md` 에 완료·조사 근거를 보강하며, 직전 ai-review 라운드(23_21_17)의 산출물(SUMMARY/RESOLUTION/각 관점 리뷰 md/retry state/meta)을 저장소에 편입한 것이다. 로직 변경은 없어(주석·문서 전용) 인젝션·하드코딩 시크릿·인증/인가·입력 검증·암호화·에러 처리 관점에서 코드 변경 자체의 신규 리스크는 없다. devDependencies 제거는 공격 표면을 축소하는 개선이며, 최종 런타임은 여전히 non-root(`USER node`)·`--frozen-lockfile` 로 공급망 무결성이 보존된다. 유일하게 지속 추적 중인 항목은 기존(diff 이전부터 존재) `@nestjs/swagger` 11.2.7 버전 핀의 보안 패치 차단 리스크인데, 이는 이번 diff 범위 밖이며 별도 후속 작업으로 이미 문서화·추적되고 있다. 전반적으로 순수 하드닝/문서 변경이며 신규 보안 결함 없음.

## 위험도

NONE
