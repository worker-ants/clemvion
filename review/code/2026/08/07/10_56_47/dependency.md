# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 새로 드러난 `@aws-sdk/core@3.977.4` deprecation — 이번 PR 이 유발한 것은 아니나 트리에 그대로 남는다
  - 위치: `pnpm-lock.yaml:907` (`deprecated: |-` 블록, 907~909)
  - 상세: 이번 diff 는 `@aws-sdk/core` 의 **버전 자체는 바꾸지 않고**(`3.977.4` 그대로, context 줄) `deprecated` 필드만 새로 나타났다 — 즉 npm 레지스트리가 사후에 이 버전을 "Document number parsing bug in JSON" 사유로 deprecated 처리했고, 이번 lockfile 재생성 시 그 메타데이터가 처음 반영된 것이다. `@aws-sdk/client-s3`(direct dependency, `^3.1097.0`)의 전이 의존성이라 프로덕션 트리에 포함된다. 이번 PR 의 목적(undici/hono/fast-uri/js-yaml/socket.io-parser 패치)과는 무관하지만, JSON 상의 큰/정밀 숫자를 다루는 S3 메타데이터 파싱 경로가 있다면 실사용 영향권일 수 있다.
  - 제안: 이번 PR 범위 밖이므로 차단 사유는 아니다. 다만 `pnpm-workspace.yaml` 의 `auditConfig.ignoreCves` 관리 절차(§ audit 정책 주석)와 별개로, 이 deprecation 은 `pnpm audit` 에 안 잡히는 종류(취약점이 아니라 버그 공지)이므로 놓치기 쉽다. 후속 작업으로 `@aws-sdk/client-s3` 업그레이드 여부를 트래킹할 것을 권장.

- **[INFO]** `socket.io-parser` override 는 형제 항목들과 달리 `^` 대신 `~` 를 쓴다 — 의도적이며 근거가 충실함
  - 위치: `pnpm-workspace.yaml:34-37`(주석+override), `pnpm-lock.yaml:17`, `codebase/backend/package.json` 는 해당 없음(간접 의존성)
  - 상세: `socket.io@4.8.3` 이 `socket.io-parser: ~4.2.4` 를 요구하는데, 만약 `^4.2.7` 로 override 했다면 향후 `4.3.x` 가 릴리스될 때 override 가 socket.io 의 peer 계약(`~4.2.4`, 즉 `>=4.2.4 <4.3.0`)을 깨고 강제 해소했을 것이다. `~4.2.7`(즉 `>=4.2.7 <4.3.0`)은 그 계약 안에 정확히 포함되며, GHSA-2m8v-j782-fhvr(high) 도 4.2.7 에서 패치됐다고 인라인 주석에 근거가 명시돼 있다. 실제로 `pnpm-lock.yaml` snapshot 도 `socket.io-parser@4.2.7`(4.2.6→4.2.7) 로 정확히 해소됨을 확인했다. 결함 아님 — 오히려 모범 사례로 기록.

- **[INFO]** 2-place 동기화(가드 스크립트) 정합성 확인 — 드리프트 없음
  - 위치: `pnpm-workspace.yaml:32-37`(overrides) vs `scripts/check-pnpm-security-config.py:44-46`(`EXPECTED_OVERRIDES`)
  - 상세: `fast-uri`(^3.1.5), `hono`(^4.12.34), `socket.io-parser`(~4.2.7, 신규), `undici@>=7.0.0 <7.29.0`(^7.29.0), `js-yaml` 두 스코프(^4.3.1 / ^3.15.1) 모두 두 파일에서 값까지 일치한다. 이 저장소가 과거(#1038) 겪은 "override 값만 약화되고 가드 baseline 은 안 갱신"류 회귀가 이번엔 재발하지 않았다.

## 요약

새 외부 패키지 추가는 없고, 전량 기존(직접·전이) 의존성의 patch/minor 버전 상향과 pnpm override 재스코프다: backend 직접 의존성 `undici` `^6.21.3→^6.28.0`(package.json), 그리고 `pnpm-workspace.yaml`/`pnpm-lock.yaml` override 를 통한 `fast-uri`(3.1.4→3.1.5), `hono`(4.12.27→4.12.34, 실제 resolve 는 4.13.0), `js-yaml`(4.3.0→4.3.1, 3.15.0→3.15.1), `undici` 7.x 스코프(<7.28.0→<7.29.0), 그리고 신규 `socket.io-parser: ~4.2.7` override(GHSA-2m8v-j782-fhvr 패치, socket.io 의 peer 계약을 존중하도록 `~` 사용) 추가. 모든 override 는 socket.io/`@hono/node-server`(peer `^4.12.34` 만족)/ajv(`fast-uri`) 등 상위 패키지의 선언된 peer/의존 범위 안에서 해소되어 버전 충돌은 없으며, `pnpm-lock.yaml` 의 specifier/version 쌍과 `pnpm-workspace.yaml`/`check-pnpm-security-config.py` baseline 이 전부 일치해 드리프트가 없다(이 저장소가 #1038 에서 겪은 "override 값 약화가 가드에 안 걸림" 회귀의 재발 방지가 실제로 작동). 라이선스·번들 크기·신규 의존성 관점에서는 영향이 없다(전부 기존 MIT류 OSS 패치 버전, `postcss@8.5.26`/`nanoid@3.3.17` 는 vite 계열 devDependency 전이 버전으로 런타임 번들 무관). 유일하게 부기할 사항은 이번 PR 과 무관하게 lockfile 재생성 시 처음 드러난 `@aws-sdk/core@3.977.4` deprecation 공지(JSON 숫자 파싱 버그) — 취약점 스캐너에는 안 걸리는 종류라 팀이 별도로 트래킹할 필요가 있다.

## 위험도
LOW
