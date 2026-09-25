# 신규 식별자 충돌 검토 — `plan/in-progress/lockfile-libc-pin.md`

## 발견사항

없음. target 이 새로 도입하는 식별자를 점검 관점 6가지에 대해 전수 확인했으나 기존 사용처와의 충돌을 찾지 못했다.

### 점검 상세

1. **요구사항 ID 충돌** — target 은 요구사항 ID 를 새로 부여하지 않는다. plan 문서이며 `spec_impact: none` 이고, 본문도 트래커 항목 인용·측정·처방·검증 체크리스트로만 구성돼 새 ID 발급이 없다.

2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 없음. 다루는 대상은 `packageManager` 필드 값과 pnpm 바이너리 버전 문자열뿐, 코드 레벨 타입 도입이 아니다.

3. **API endpoint 충돌** — 해당 없음. 인프라/툴체인 버전 고정 PR 로 endpoint 를 다루지 않는다.

4. **이벤트/메시지명 충돌** — 해당 없음. webhook·queue·sse 관련 식별자 도입 없음.

5. **환경변수·설정키 충돌** — 새 키 없음. `package.json` 의 기존 키 `packageManager`(현재 `pnpm@10.23.0`)를 `pnpm@10.34.5` 로, `codebase/frontend/Dockerfile.playwright-e2e` 의 corepack 폴백 `npm i -g pnpm@10.23.0` 을 `pnpm@10.34.5` 로 — 둘 다 **기존 키의 값 변경**이며 새 config key 를 만들지 않는다. 저장소 내 `10.23.0` 참조는 `package.json`·Dockerfile·과거 완료 plan(`deps-typeorm12.md`, `deps-audit-floor-refresh-2026-09.md`, `ci-required-check-skip-jobs.md`)·CHANGELOG 뿐이며, target 의 처방 범위(§B 두 파일)와 충돌 없이 일치한다.

6. **파일 경로 충돌** — 신규 파일은 plan 문서 `plan/in-progress/lockfile-libc-pin.md` 하나뿐이다. `find plan -iname '*lockfile*' -o -iname '*libc*'` 로 확인한 결과 기존에 동일 경로나 동일 이름 파일이 없다(가장 근접한 기존 파일은 `plan/complete/postcss-lockfile-drift-fix.md` 로 별개 주제·경로). 명명 컨벤션(`<주제>-<핵심동작>.md`, kebab-case)에도 부합한다.

### 교차 참조 정합성 (부가 확인)

target 이 인용하는 두 트래커 항목의 표제가 원문과 정확히 일치함을 확인했다 — 충돌은 아니지만 새 식별자가 기존 항목을 **잘못된 이름으로** 재정의하고 있지는 않은지 확인하는 차원:

- `plan/in-progress/deps-guard-hardening.md:384` `### 후속 — lockfile \`libc:\` 필드가 커밋마다 진동한다 (2026-08-09 발견, P3)` — target 의 인용과 일치.
- `plan/in-progress/spec-draft-nullable-notation-followups.md:5197` `lockfile 의 \`libc:\` 필드가 dependabot 과 고정 pnpm 사이에서 진동한다` — target 의 인용과 일치.

target 이 언급하는 `scripts/check-pnpm-security-config.py` (deps-guard-hardening.md 쪽 후속 항목에 등장) 은 저장소에 이미 존재하는 기존 스크립트이며, target 본문은 이를 새로 도입하지 않고 참조도 하지 않는다 — 충돌 여지 없음.

## 요약

target 은 인프라 버전 고정(pnpm pin) plan 으로, spec 영역·엔티티·API·이벤트·환경변수 어느 층에서도 **새 식별자를 도입하지 않는다**. 유일한 신규 이름은 plan 파일 경로 자체이며 기존 파일·명명 컨벤션과 충돌하지 않는다. 변경 대상인 `package.json` 의 `packageManager` 키와 `Dockerfile.playwright-e2e` 의 pnpm 버전 문자열은 기존 키의 **값 갱신**일 뿐 신규 키가 아니므로 이 관점에서는 검토 대상이 아니다. 신규 식별자 충돌 관점에서 이 target 은 안전하다.

## 위험도

NONE
