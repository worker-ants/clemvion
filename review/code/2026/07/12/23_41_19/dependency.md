# 의존성(Dependency) Review

검증: `git diff origin/main --stat` 로 이번 변경 전체 파일 목록 확인(`codebase/backend/Dockerfile`,
`plan/in-progress/pnpm-migration-followups.md`, `review/code/2026/07/12/23_21_17/*` 14개 신규 리뷰
산출물). `package.json`/`pnpm-lock.yaml`/`.npmrc` 는 diff 에 포함되지 않음(전량 확인).

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 이번 diff 전체에 `package.json`/`pnpm-lock.yaml` 변경 없음
  - 위치: 전체 diff (`git diff origin/main --stat`)
  - 상세: `codebase/backend/Dockerfile` 변경은 직전 라운드(23_21_17)에서 이미 리뷰된 `prod-deps`
    스테이지 신설 로직과 동일하며, 이번 diff 에서 바뀐 부분은 RESOLUTION I2 반영 주석 정밀화
    (`` `[ -d dist ] || tsc` 가드라 dist 가 이미 있으면 tsc 를 스킵 `` 문구 추가)뿐이다. 로직·의존성
    변화 없음. `plan/in-progress/pnpm-migration-followups.md` 는 완료 기록·조사 메모 텍스트만
    추가되고, 나머지 12개 파일은 직전 라운드의 리뷰 산출물(SUMMARY/RESOLUTION/개별 리뷰어 `.md`/
    `_retry_state.json`/`meta.json`)을 커밋에 편입하는 것으로 모두 문서/JSON이며 런타임 의존성과
    무관하다.
  - 제안: 없음(정보성).

- **[INFO]** 버전 고정(pinning) 상태 불변 확인
  - 위치: `codebase/backend/Dockerfile` (`deps`/`prod-deps` 두 스테이지 모두 `--frozen-lockfile`)
  - 상세: 이번 diff 는 `--frozen-lockfile` 플래그·`pnpm.overrides`(`@nestjs/swagger` 11.2.7 핀)·
    `onlyBuiltDependencies` 설정 어느 것도 건드리지 않는다. 직전 라운드에서 이미 실측 검증된
    "버전 드리프트·핀 우회 없음" 결론이 이번 주석-전용 변경으로 영향받지 않는다.
  - 제안: 없음.

- **[WARNING → 이미 문서화됨, 조치 불요]** 직전 라운드 `dependency.md` 아카이브의 "내부 의존성 확산
  없음" 주장이 같은 배치의 `requirement.md` 실측으로 반증되었음 — 아카이브 정정 기록 확인
  - 위치: `review/code/2026/07/12/23_21_17/dependency.md` (신규 커밋되는 아카이브 파일) 마지막
    발견사항 vs `review/code/2026/07/12/23_21_17/requirement.md` WARNING 1
  - 상세: 이번 diff 로 처음 커밋되는 `dependency.md` 아카이브는 "`--filter "backend..."` 스코프
    유지로 frontend·channel-web-chat 등 무관 워크스페이스 devDependencies 가 최종 이미지로 새어
    들어올 여지는 없다"(INFO, 위험도 NONE)고 판단했다. 그러나 같은 배치에 함께 커밋되는
    `requirement.md` 는 실제 `docker build` + 컨테이너 내부 실사로 **정반대 사실**(`next` 169MB·
    `@next` 238.7MB·`webpack`·`react` 등 프런트엔드 스택 ~400MB+ 가 `node-linker=hoisted` 특성으로
    실제 잔존)을 실측 확인했다(WARNING, MEDIUM). 즉 아카이브에 영구 저장되는 `dependency.md`
    문서 자체는 팩트가 틀린 채로 남는다. 다행히 이 모순은 방치되지 않고 이번 diff 의
    `plan/in-progress/pnpm-migration-followups.md` §1 "스코프 정직화" 단락과
    `review/code/2026/07/12/23_21_17/RESOLUTION.md` W1 에 정정 사실이 명시적으로 기록되어 있어,
    최신·정확한 소스는 plan 문서 쪽이다.
  - 제안: 코드·이번 diff 자체에 조치는 불요(RESOLUTION 이 이미 plan 문서를 SoT 로 정정 완료).
    다만 향후 이 저장소의 의존성 이슈를 조사할 때 `review/code/2026/07/12/23_21_17/dependency.md`
    의 "확산 없음" INFO 를 그대로 신뢰하지 말고, `plan/in-progress/pnpm-migration-followups.md`
    §1 스코프 정직화 노트(및 `requirement.md`)를 최신 사실로 참조할 것. (리뷰 아카이브는 시점
    스냅샷이라 소급 수정 의무는 없음 — CLAUDE.md 1회성 문서 정책과 일치.)

- **[INFO]** 프런트엔드 스택 잔존 해소 옵션(A: `pnpm deploy --prod`, §3: node-linker strict 전환)이
  plan 에 후속 등재 — 실행 시 의존성 격리 방식 자체가 바뀌므로 별도 라운드에서 재검토 필요
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §1 "후속(별도)" 단락, §3
  - 상세: 이번 diff 는 문서화만 하고 구현하지 않음. 두 옵션 모두 backend 프로덕션 이미지의
    `node_modules` 구성 방식을 바꾸는 변경이라(하나는 self-contained deploy dir, 하나는
    workspace-wide strict isolation) 실행 PR 에서는 native addon(bcrypt/isolated-vm) 재해소·
    내부 `@workflow/*` 패키지 심링크 경로가 정상 동작하는지 다시 검증이 필요할 것.
  - 제안: 없음(추적 중, 이번 diff 범위 밖).

- **[INFO]** `openapi3-ts` 는 여전히 조사 단계 후보일 뿐 실제 추가되지 않음 — 라이선스/영향 재확인
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §2 "조사(2026-07-12, defer)" 단락(신규 추가)
  - 상세: 직전 라운드에서 이미 확인된 내용과 동일 — `openapi3-ts` 는 MIT 라이선스, devDependency
    후보(런타임 번들 영향 없음), 이번 diff 에서 `package.json`/`pnpm-lock.yaml` 변경 없음(재확인).
    새로 추가된 조사 메모는 "완료 조건"(11.2.7→11.4.x 버전 bump + `openapi3-ts` 신규 devDep 3곳
    deep-import 교체)을 더 구체화했을 뿐이며, 신규 의존성 도입은 별도 focused PR 로 분리 결정.
  - 제안: 없음(정보성 — 실행 시점에 버전 bump 리스크·DTO 스키마 회귀 테스트 의존을 이미 인지하고
    있으므로 별도 PR 착수 시 재검증 필요하다는 점만 재확인).

- **[INFO]** `js-yaml` moderate 취약점 accept 는 이번 diff 범위 밖의 기존 미해결 항목
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §4 "기타(low)" (변경 없이 유지된 기존 텍스트)
  - 상세: "`js-yaml moderate accept` 의 CVE ID·영향 경로 문서화 — `pnpm why js-yaml` 추적" 항목은
    이번 diff 로 신규 도입되거나 수정된 것이 아니라 이전부터 남아있는 미해결 후속 항목이다.
  - 제안: 없음(범위 밖, 추적 유지).

## 요약

이번 diff 는 신규 외부 패키지·버전 변경을 포함하지 않는다(`package.json`/`pnpm-lock.yaml` 무변경
전량 확인). `codebase/backend/Dockerfile` 은 직전 라운드에서 NONE 위험도로 리뷰된 `prod-deps`
스테이지 로직 그대로이며 이번엔 주석 정밀화(RESOLUTION I2 반영)만 있어 의존성 리스크에 변화가
없다. 유일하게 짚어둘 점은, 이번 diff 로 아카이브에 영구 저장되는 직전 라운드의
`review/code/2026/07/12/23_21_17/dependency.md` 가 "무관 워크스페이스 devDependencies 확산 없음"
이라고 판단했으나, 같은 배치의 `requirement.md` 실측(실제 `docker build` + 컨테이너 검사)으로 그
판단이 틀렸음이 드러났고(`node-linker=hoisted` 특성상 frontend 프로덕션 의존성 ~400MB+ 가 실제
잔존) — 다행히 `plan/in-progress/pnpm-migration-followups.md` §1 의 "스코프 정직화" 단락(이번
diff 에 포함)이 정정된 사실을 SoT 로 명시하고 있어 코드·문서 정합성 문제는 이미 해소되어 있다.
`openapi3-ts`(swagger 핀 제거용 후보 devDep)와 `js-yaml` moderate CVE 는 모두 이번 diff 의 실제
변경이 아닌 조사/추적 메모이며 별도 후속 PR 로 적절히 분리되어 있다.

## 위험도
NONE
