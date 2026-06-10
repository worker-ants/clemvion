# Refactor 백로그 — 보안 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 7 / Minor 4 — **spec 대조(2026-06-10) 후 전 항목 유효** (철회 0).
> **spec 대조 판정 분포**: A 6 (C-2, M-2, M-3, m-2, m-3, m-4) / B 2 / C 2 (M-6, M-7 — spec 자체 갭/enforcement 비대칭) / D 4.
> **⚠️ A(의도된 트레이드오프)인데 여전히 위험**: C-2, M-2, M-3 (결정 대기), m-4 (✅ 2026-06-10 사용자 승인 — pub/sub 전파 진행 확정). spec 이 위험을 인지·기록했으나 방어가 실질 불충분한 항목들로, 제거하지 않고 유지한다.
> 전반 평가: SSRF 이중 레이어, AES-256-GCM(AAD), WS 소유권 검증, DOMPurify, OAuth state 등 핵심 패턴 양호. fail-closed 부팅 가드의 **비대칭**(EIA·STUB 류는 있고 C-1·M-4·M-7 은 없음)이 공통 패턴.
> 옵션 비교·권장안 보강 (2026-06-10)

## Critical

- [ ] **C-1 JWT secret 기본값 fallback** — `backend/src/common/config/jwt.config.ts:4`
  - **spec 대조**: D — auth spec 은 secret 부팅 정책 무언급이나, **동형 secret 의 fail-closed 가 spec 에 명문화돼 있음**: `14-external-interaction-api.md:651` "`INTERACTION_JWT_SECRET` … production 에서는 생성자가 throw 해 부팅 차단 (fail-closed — OAUTH_STUB/LLM_STUB 가드와 동형)". 코어 `JWT_SECRET` 에만 그 표준 패턴이 누락된 갭 — 의도된 트레이드오프 아님.
  - **추적**: 기존 plan [`../security-jwt-secret-fallback.md`](../security-jwt-secret-fallback.md) (미착수, P0). 본 백로그는 우선순위 상향만 표시.
  - **개선 방안**: 1. `|| 'dev-jwt-secret'` 제거 + `main.ts` 부팅 가드에 `production && !JWT_SECRET → throw` (EIA/STUB 가드와 동일 위치·패턴 — M-4·M-7 과 단일 "production secret/insecure-flag 가드" 블록으로 응집 권장). 2. `ENCRYPTION_KEY`/`INTERACTION_JWT_SECRET` 동반 점검(M-4 합류). 3. dev/test/e2e 의 JWT_SECRET 주입 경로 선점검 — e2e 가 기본값에 암묵 의존 시 부팅 실패.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. fallback 제거 + C-1·M-4·M-7 단일 "production secret/insecure-flag 가드" 블록으로 일괄 처리 | spec 의 기존 fail-closed 표준(`14-external-interaction-api.md:651` INTERACTION_JWT_SECRET·OAUTH_STUB/LLM_STUB 동형)과 정합. 가드 로직 1곳 응집 → 이후 신규 secret 추가 시 누락 재발 방지. 검증 테스트도 한 묶음 | 3개 항목이 한 PR 에 묶여 변경 폭 증가. dev/test/e2e 의 `JWT_SECRET` 주입 경로 전수 선점검 필요 — 기본값 암묵 의존 시 부팅 실패 |
    | B. C-1 만 개별 가드 추가 (M-4·M-7 별도 진행) | 변경 폭 최소, P0 단독 빠른 머지 | 동형 가드가 3곳에 분산 작성될 위험 — 백로그가 지적한 "fail-closed 비대칭" 패턴이 코드 구조로도 반복됨. e2e 주입 경로 점검을 항목마다 3회 반복 |
    | C. 현상 유지 + production 부팅 시 warn 로그만 | 기존 배포 무파손, 즉시 적용 가능 | 기본 secret 으로 서명된 토큰 위조(인증 우회)가 Critical 그대로 잔존. spec 의 동형 fail-closed 표준과 비대칭 지속 — warn 은 운영자가 못 볼 수 있음 |
  - **권장**: A — 위협이 인증 전면 우회(기본 secret 토큰 위조)라 warn 수준(C)으로는 불충분하고, spec 이 이미 동형 secret 에 throw 표준을 명문화해 정책 논쟁이 없다. M-4·M-7 과 같은 위치(`main.ts`)·같은 패턴이므로 단일 블록으로 묶는 편이 구현·테스트 비용이 오히려 낮고, 이후 secret 추가 시 누락 재발을 구조적으로 막는다. 유일한 회귀 리스크(e2e 기본값 의존)는 주입 경로 선점검으로 통제 가능.
  - 검증: production+미설정 부팅 거부 unit / dev 정상+warn. / 회귀 위험: e2e 기본값 의존 — 주입 경로 선점검 필수. / spec 갱신: `1-auth.md §2` 에 fail-closed 1줄 + Rationale (planner).

- [ ] **C-2 code 노드 `vm.Script` 는 sandbox 가 아님 — host 탈출 가능** ⚠️ **(A — spec 이 위험을 명시 기록한 트레이드오프, 그러나 여전히 위험)** — `nodes/data/code/code.handler.ts:212-233`
  - **spec 대조**: **A** — `2-code.md §7.1` Rationale: "`node:vm` 은 … **완벽한 sandbox escape 방어는 불가**하므로 추후 `isolated-vm` 등으로 재검토한다" + 로드맵 행 "필요해지면 isolated-vm(V8 Isolate) 또는 Docker 격리로 전환". 즉 escape 위험은 spec 이 인지한 의도적 트레이드오프. **그러나** Editor 권한만으로 `this.constructor.constructor('return process')()` 류 prototype-chain 탈출 → 호스트 장악이 성립하고, spec 은 위협 모델 경계(다중 워크스페이스 SaaS vs self-host)를 명시하지 않음 — 위험 수용 주체가 불명확. **사용자 보고 대상.**
  - **개선 방안**: 1. (근본) `isolated-vm` 전환 — spec 로드맵이 이미 지정 (네이티브 빌드 의존성 트레이드오프 수반). 2. (대안) 권한 박탈 `worker_threads` 또는 컨테이너/gVisor runner — self-host 배포 단순성 우선이면 컨테이너가 적합. 3. (단기 완화) 노출 생성자의 `.constructor` 접근 차단(frozen prototype 셰도 객체) — 단 근본 해결 아님(우회 다수). **Promise 제거 단기완화는 M-2 참조 — spec 모순이라 단독 불가.**
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `isolated-vm` 전환 | spec 로드맵(`2-code.md §7.1` "추후 isolated-vm 등으로 재검토")이 이미 지정한 경로 — spec 개정 부담 최소. V8 Isolate 격리로 prototype-chain 탈출(`constructor.constructor('return process')`)이 구조적으로 차단됨 — host 객체가 isolate 안에 존재하지 않음. 메모리·CPU 상한을 isolate 단위로 강제 가능. 프로세스 내 실행이라 노드당 latency 오버헤드 낮음 | **네이티브 빌드 의존성**(node-gyp + C++ toolchain) — self-host `npm install` 환경에 빌드 도구 요구, 배포 단순성 저하. Node 메이저 업그레이드마다 리빌드·호환성 추적 필요. **`$helpers` 전달 방식 전면 변경** — 객체 직접 주입 불가, Reference/ExternalCopy 로 재설계 필요 (dayjs·crypto 등 기존 사용자 코드 호환성 audit 필수, 백로그 본문 명시). V8 자체 버그에 의한 탈출 가능성은 잔존(동일 프로세스) |
    | B. 권한 박탈 `worker_threads` | 표준 라이브러리만 사용 — 네이티브 의존성·추가 인프라 없음. structured clone 으로 데이터 전달이 단순 | **worker_threads 는 보안 경계가 아님** — 같은 프로세스 주소 공간을 공유하고 `process`·fs 접근이 기본 가능해, vm 탈출 문제의 격리 강도를 본질적으로 개선하지 못함. 권한 박탈을 직접 구현해야 하며 우회 면적이 vm 셰도잉과 유사하게 넓음. 격리 강도 대비 구현 비용이 가장 비효율 |
    | C. 컨테이너/gVisor runner (Docker 격리) | 격리 강도 최강 — 커널 수준 경계로 V8 버그·prototype 탈출 모두 무력화. spec 로드맵의 두 번째 지정 경로("또는 Docker 격리"). 코드 실행 자원(CPU/mem/net) 을 컨테이너 단위로 완전 통제 — 다중 워크스페이스 SaaS 위협 모델에 가장 적합 | **운영 복잡도 최대** — runner 이미지 빌드·배포, 노드 실행마다 컨테이너 기동(cold-start latency) 또는 warm pool 관리. self-host 에 Docker/gVisor 런타임 전제 추가 — "self-host 배포 단순성 우선이면 컨테이너가 적합" 은 권한 분리 관점이고, 인프라 요구 관점에선 가장 무거움. `$helpers` 는 IPC/HTTP 직렬화 경유 — 함수형 helper 재설계 필요 |
    | D. 현상 유지 + 단기 완화(frozen prototype 셰도잉) + 위협 모델 문서화 | 즉시 적용 가능, 의존성·인프라 변화 없음. spec 이 위험을 이미 인지·기록한 트레이드오프(A 판정)라 "수용 주체 명시" 문서화만으로도 현 상태보다 개선 | 백로그 본문이 명시하듯 **근본 해결 아님 — 우회 다수**. Editor 권한 사용자의 호스트 장악 경로가 열린 채 유지. 다중 워크스페이스 운영이면 워크스페이스 간 격리 붕괴 — 수용 불가능한 위협. self-host 단일 테넌트에서만 정당화 가능 |
  - **권장**: A (isolated-vm) — 위협 모델의 핵심이 "Editor 권한 → 호스트 장악" 인 이상 D 는 다중 워크스페이스 배포에서 수용 불가하고, B 는 격리 강도를 실질 개선하지 못한다. A 는 spec 로드맵이 이미 지정한 경로라 의사결정 비용이 가장 낮으면서 prototype-chain 탈출을 구조적으로 차단하고, C 대비 운영 복잡도·latency 부담이 작다. 네이티브 빌드 의존성과 `$helpers` 호환성 audit 이 비용이지만 1회성 전환 비용이며, 다중 테넌트 SaaS 로 확장해 V8 버그 잔존 위험까지 제거해야 할 시점에 C(gVisor) 를 후속 강화로 검토하면 된다. 어느 쪽이든 §7.1 위협 모델 경계(SaaS vs self-host) 명시는 선행 필수.
  - 검증: vm escape PoC 회귀 테스트 — 현재 통과(취약)함을 빨간불로 만들고 전환 후 차단 확인. / 회귀 위험: isolated-vm 은 `$helpers` 전달 방식이 달라 기존 사용자 코드 호환성 검증 필요(dayjs·crypto 직렬화) + node-gyp 빌드 추가. / spec 갱신: §7.1 에 위협 모델(code 노드 작성 권한 = Editor+)과 운영 경계 Rationale 명시, 전환 시 "현재 구현" 행 교체 (planner).

- [ ] **C-3 `authentication=none` HTTP Request 노드 SSRF 가드 미적용 — spec 내부 모순 발견** — `nodes/integration/http-request/http-request.handler.ts:316-356`
  - **spec 대조**: D — **현 동작은 spec 에 충실**: `1-http-request.md §4 step 8` "SSRF 가드 (`authentication='integration'` **일 때만**)". **그러나 같은 문서 §104 노트("기본은 차단 — secure-by-default … self-host 가 정당 접근 시에만 `ALLOW_PRIVATE_HOST_TARGETS` 켠다")와 상호 모순**이고, 코드 주석의 정당화("may legitimately target internal services")는 **어느 spec 에도 근거 없음**(키워드 검색 0건). 그 용도는 이미 `ALLOW_PRIVATE_HOST_TARGETS` opt-out 으로 충족 — none 무가드를 둘 이유 없음. DB/Email/MCP 의 일관된 secure-by-default posture·`NF-SC-05`(OWASP) 와도 배치.
  - **개선 방안**: 1. (근본) 가드를 인증 방식 **무관하게 전체 outbound** 에 적용 — 내부 접근은 `ALLOW_PRIVATE_HOST_TARGETS=true` 로만 (타 노드와 동일 플래그·posture). 2. (보강) redirect manual follow 의 매 홉 재검증도 none/custom 으로 확장. 3. (인프라) IMDSv2 강제 + egress 방화벽 병행.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 가드를 전 인증 방식(none/custom 포함) outbound 에 적용 + 기존 `ALLOW_PRIVATE_HOST_TARGETS` opt-out 단일화 | spec §104 의 secure-by-default 원칙("기본은 차단 … self-host 가 정당 접근 시에만 켠다") 및 DB/Email/MCP 의 일관 posture·NF-SC-05 와 정합 — spec 내부 모순을 코드 쪽에서 해소. 신규 env 없이 기존 플래그 재사용 — 운영자 멘탈 모델 단일. redirect 매 홉 재검증 확장과 자연 결합 | **기존 self-host 워크플로 파손** — none 으로 사내 API 호출하던 배포는 플래그를 켜기 전까지 호출 실패. 마이그레이션 경로 필수: 릴리스 노트 명시 + 최소 1릴리스 동안 부팅 시 "none 인증 + private 대상 감지 시 차단 예정" warn(또는 차단 시 에러 메시지에 플래그 안내) 제공 |
    | B. none 한정 별도 allowlist env 신설 (예: 허용 내부 host 목록) | 기존 워크플로를 host 단위로 정밀 허용 — 전면 opt-out 보다 세분화된 통제 | 플래그 이원화(`ALLOW_PRIVATE_HOST_TARGETS` 와 별도 체계) — 어느 spec 에도 근거 없는 신규 표면이고 DB/Email/MCP 와 posture 분기 지속. 코드 주석의 무근거 정당화를 env 로 승격하는 모양새. allowlist 관리 부담 + DNS rebinding 은 host 명 allowlist 로 불완전 방어 |
    | C. 현상 유지 + spec §4 step 8 을 "none 은 의도적 무가드" 로 명문화 | 코드 무변경 — 기존 배포 무파손 | none 인증만으로 `169.254.169.254`(IMDS)·내부망 도달이 계속 열림 — SSRF 의 전형적 악용 면이 그대로. §104 의 secure-by-default 서술과의 모순을 "예외 명문화" 로 봉합하는 것이라 spec 일관성 훼손. 그 용도가 이미 opt-out 플래그로 충족되므로 예외를 둘 정당성이 없음(백로그 판정) |
  - **권장**: A — none 무가드를 둘 이유가 "이미 `ALLOW_PRIVATE_HOST_TARGETS` 로 충족" 된다는 게 spec 대조의 결론이므로, 전체 적용 + 기존 opt-out 단일화가 위협(클라우드 IMDS·내부망 SSRF) 차단과 spec 정합을 동시에 만족하는 유일한 안이다. 유일한 비용인 기존 self-host 워크플로 파손은 부팅/차단 시 warn + 릴리스 노트 + 플래그 1개 설정이라는 명확한 마이그레이션 경로로 통제 가능하다. spec §4 step 8 ↔ §104 모순 해소(planner)가 선행이어야 한다.
  - 검증: none 인증으로 `169.254.169.254`/`10.0.0.1`/DNS rebinding 차단 e2e + 플래그 on 시 통과. / 회귀 위험: **none 으로 사내 API 호출하던 기존 self-host 워크플로가 깨짐** — 릴리스 노트 + 부팅 warn 필요. / **spec 갱신: 필요** — §4 step 8 을 "전 인증 방식 적용" 으로 수정 + §104 와 정합화 + Rationale 기록 (planner — spec 모순 해소가 선행).

## Major

- [ ] **M-1 Swagger UI 프로덕션 무인증 노출** — `main.ts:147`
  - **spec 대조**: B — `swagger.md`(DTO 패턴만)·`2-api-convention.md` 모두 UI 노출 게이팅 무언급. 의도 근거 없음.
  - **개선 방안**: 1. `NODE_ENV !== 'production'` 분기 (OAUTH/LLM stub 가드와 동일 패턴). 2. (대안) prod 노출 필요 시 `ENABLE_SWAGGER_IN_PROD` opt-in + Basic Auth/IP allowlist 전치.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `NODE_ENV !== 'production'` 분기로 prod 미노출 + `ENABLE_SWAGGER_IN_PROD` opt-in escape hatch | OAUTH/LLM stub 가드와 동일 패턴 — 코드·운영 멘탈 모델 일관. API 표면 정찰(엔드포인트·DTO 구조 노출) 차단을 기본값으로. prod 디버깅 습관은 opt-in 으로 보존 | opt-in env 1개 추가. opt-in 시에는 여전히 무인증 노출 — 켜는 순간 같은 위험 복귀 |
    | B. prod 노출 유지 + Basic Auth/IP allowlist 전치 | prod 에서 문서 접근 워크플로 무중단 | 인증 계층 신규 구현·자격증명 관리 부담. spec(swagger.md·api-convention)에 prod 노출 의도 근거가 없는데(B 판정) 노출을 전제로 보강하는 우선순위 역전 |
    | C. 현상 유지 | 무비용 | 무인증 API 표면 정찰 면 지속 — 의도 근거 없는 노출(B 판정)을 방치 |
  - **권장**: A — 노출 의도가 spec 어디에도 없으므로 기본 차단이 맞고, stub 가드와 동형 패턴이라 구현 비용이 가장 낮다. opt-in escape hatch 가 prod 디버깅 요구를 흡수하므로 B 의 인증 계층 구현은 그 요구가 실제로 상시화될 때 검토해도 늦지 않다.
  - 검증: prod 빌드 `/docs` 404, dev 200. / 회귀 위험: prod 디버깅 습관 — opt-in env 로 escape hatch. / spec 갱신: swagger.md 또는 api-convention 에 "non-production 전용" 규약 (planner).

- [ ] **M-2 vm sandbox 에 `Promise` 생성자 직접 노출** ⚠️ **(A — spec 이 명시 약속한 기능: 단독 제거 불가)** — `code.handler.ts:129`
  - **spec 대조**: **A** — `2-code.md §4.1` "비동기 코드 지원: async/await / Promise 모두 사용 가능", §7.3 허용 표에 Promise 명시. **원안의 "Promise: undefined 단기완화" 는 spec 과 정면 모순** — async 지원이 code 노드의 기능 약속이라 단독 적용 시 모든 async 사용자 코드 파손. **사용자 보고 대상.**
  - **개선 방안**: 1. (근본) C-2 의 isolated-vm/컨테이너 전환에 **흡수** — Promise 를 안전하게 유지하며 격리. 본 항목 단독 처리 금지. 2. (단기를 굳이 택한다면) §4.1/§7.3 의 spec 개정 동반 필수 (async 철회 또는 안전 래퍼) — planner 합의 없이 코드만 변경 금지.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. C-2 의 격리 전환(isolated-vm/컨테이너)에 흡수 — 본 항목 단독 처리 없음 | spec §4.1/§7.3 의 async/Promise 기능 약속을 그대로 유지하면서 Promise 경유 탈출면을 격리 계층에서 무력화 — 기능·보안 동시 충족. spec 개정 불요 | C-2 결정·구현 완료까지 본 항목 미해결 상태 지속 — 단 C-2 자체가 Critical 이라 일정상 선행됨 |
    | B. `Promise: undefined` 단기 제거 + spec §4.1/§7.3 개정(async 철회) | 즉시 적용 가능 | **spec 과 정면 모순**(§4.1 "async/await/Promise 모두 사용 가능" 명시) — 모든 async 사용자 코드 전면 파손. 기능 약속 철회라는 제품 결정을 보안 단기완화가 강제하는 본말전도. planner 합의 없이는 금지(백로그 명시) |
    | C. 안전 래퍼 Promise(셰도 객체) 주입 + spec §7.3 개정 | async 기능 유지하며 노출 표면 축소 시도 | C-2 의 frozen-prototype 셰도잉과 동일한 한계 — 우회 다수, 근본 해결 아님. 래퍼 구현·유지보수 비용 대비 격리 강도 개선 미미. 어차피 C-2 전환 시 폐기될 코드 |
  - **권장**: A — Promise 노출의 위험은 vm 격리 부재(C-2)의 부분집합이므로 근본 원인을 풀면 함께 해소되고, B·C 는 spec 의 기능 약속을 깨거나(전면 파손) 폐기 예정 코드를 만드는 비용만 발생시킨다. 본 항목은 C-2 plan 에 합류 표기하고 단독 PR 을 만들지 않는 것이 운영·리뷰 비용 최소다.
  - 검증: §4.1 top-level await 예시 회귀. / 회귀 위험: Promise 제거 = async 전면 파손. / spec 갱신: 단기안 채택 시 §4.1/§7.3 개정 필수.

- [ ] **M-3 ReDoS — regex 길이 제한만 있고 위험 패턴 검출 없음** ⚠️ **(A — 단 spec 의 방어 효과 주장이 부정확)** — `condition-evaluator.util.ts:202-213`, `filter.handler.ts:102`, `transform.handler.ts:38`
  - **spec 대조**: **A** — 길이 200 제한이 spec 의 명시 정책: `1-transform.md:66` "ReDoS 방지를 위해 regex 패턴 길이는 200자 이내", filter/if-else/switch 동일. **그러나 길이 제한은 ReDoS 를 막지 못함** — 200자 이내 `(a+)+$` 지수 패턴이 worker 무기한 점유 가능. spec 이 "방지" 라 단언한 효과 주장이 부정확 — NF-SC-05 목표 미달성. **사용자 보고 대상.**
  - **개선 방안**: 1. (근본) `re2`(선형 시간 보장)로 사용자 regex 평가 교체. 2. (대안) `safe-regex`/`recheck` 컴파일 시 사전 검출 → silent false + `meta.invalidRegexPatterns` 기존 채널로 가시화. 3. (단기) regex 실행 timeout/AbortController 상한.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `re2` 로 사용자 regex 평가 교체 | 선형 시간 **보장** — ReDoS 를 클래스 단위로 제거(휴리스틱 아님). NF-SC-05 목표를 구조적으로 충족 | **backreference·lookahead/lookbehind 미지원** — 해당 구문을 쓰던 기존 사용자 패턴이 컴파일 실패로 동작 변경(전수 audit 필수, 사용자 가시 회귀). **네이티브 빌드 의존성** — C-2 isolated-vm 과 동일한 self-host `npm install` 빌드 도구 부담. 3개 노드(transform/filter/condition) 평가 경로 모두 교체 |
    | B. `safe-regex`/`recheck` 컴파일 시 사전 검출 → 위험 패턴 silent false + `meta.invalidRegexPatterns` 가시화 | 순수 JS — 네이티브 의존성 없음. 위험 패턴만 거부하므로 backreference/lookahead 를 쓰는 정상 패턴은 무영향 — 호환성 파손 최소. **기존 silent false + `meta.invalidRegexPatterns` 채널 재사용** — 노드 동작 규약(에러 대신 가시화) 정합 | 휴리스틱 기반 — false negative(놓치는 위험 패턴) 가능성이 원리상 잔존, re2 같은 보장은 아님. false positive 시 정상 패턴이 silent false 로 떨어져 디버깅 혼란 가능(meta 채널로 완화) |
    | C. regex 실행 timeout 래핑 | 패턴 호환성 100% 유지 — 어떤 구문도 거부하지 않음 | JS regex 실행은 동기라 같은 스레드에서 중단 불가 — 실효적 timeout 은 별도 worker/프로세스 격리 + kill 이 필요해 구현 복잡도가 외형보다 큼. 사후 차단이라 timeout 동안의 CPU 점유는 허용됨(부분 DoS 잔존) |
  - **권장**: B — 위협(200자 이내 지수 패턴의 worker 점유)을 컴파일 시점에 차단하면서 네이티브 의존성·기존 패턴 파손이라는 A 의 두 비용을 모두 회피하고, 기존 invalidRegexPatterns 가시화 채널과 노드 규약이 그대로 맞는다. re2 의 선형 보장이 필요해지는 근거(휴리스틱 우회 실사례)가 생기면 A 로 승급하되, 그 시점엔 backreference/lookahead 사용 패턴 audit 과 self-host 빌드 영향 공지가 선행돼야 한다. spec 4곳의 "길이 200 = ReDoS 방지" 서술 정정은 어느 안이든 필수.
  - 검증: `(a+)+$` + 긴 비매칭 입력 평가 시간 상한 회귀(현재 hang 재현 → 수정 후 빠른 false). / 회귀 위험: re2 는 backreference/lookahead 미지원 — 기존 사용자 패턴 호환성 audit 필수. / **spec 갱신: 필요** — 4개 spec 의 "길이 200 = ReDoS 방지" 서술 정정 + ReDoS 정책을 1곳(0-common 또는 expression-language)에 단일 정의 (planner).

- [ ] **M-4 `.env.example` 의 ENCRYPTION_KEY 가 실사용 가능한 구체값** — `.env.example:139-140`
  - **spec 대조**: D — `secret-store.md:151` 은 "정확 64-char hex (.env.example 의 표준)" 으로 **형식**만 표준화 — 복붙 가능한 구체값이어야 한다는 의도는 없음. 같은 파일의 `INTEGRATION_ENCRYPTION_KEY=change-me-...` placeholder 와 비대칭.
  - **개선 방안**: 1. 형식 유지하되 명백한 placeholder 로(`0000…0000` + 주석 "MUST regenerate: openssl rand -hex 32"). 2. 부팅 시 알려진 예시값과 일치하면 prod 거부/dev 경고 — C-1·M-7 가드 블록과 합류.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 명백한 placeholder 화(`0000…0000` + "MUST regenerate" 주석) + 알려진 예시값 부팅 거부(prod)/경고(dev) — C-1·M-7 가드 블록 합류 | 복붙 운영 사고를 2중 차단(눈에 띄는 placeholder + 부팅 가드). `INTEGRATION_ENCRYPTION_KEY=change-me-...` 의 기존 placeholder 관행과 대칭 회복. 가드는 단일 블록에 1줄 추가 수준 | dev/e2e 가 현 구체 hex 에 의존하면 test env 수정 필요 — 64-hex 경로와 SHA-256 derive 경로(§152-153) 양쪽 통과 점검(백로그 명시). 알려진 예시값 목록을 가드에 하드코딩하는 소량의 결합 |
    | B. placeholder 교체만 (부팅 가드 없음) | 변경 최소 — `.env.example` 1곳 | 이미 예시값을 복사해 운영 중인 배포를 탐지 못함 — 알려진 키로 암호화된 secret store 는 사실상 평문. 신규 설치만 보호 |
    | C. 현상 유지 + 주석 강화 | 무비용 | "정확 64-char hex (.env.example 의 표준)" 이라는 spec 문구가 구체값 복붙을 오히려 유도하는 현 상태 지속 |
  - **권장**: A — 핵심 위협이 "공개 저장소에 있는 키를 그대로 쓰는 운영 배포"(secret store 전체 복호 가능)이므로, 신규 설치만 막는 B 로는 기존 배포를 구제하지 못한다. 부팅 가드는 C-1·M-7 단일 블록에 합류하면 한 줄 추가 수준의 비용이고, 회귀 면은 test env 점검으로 한정된다.
  - 검증: 예시값 부팅 prod 거부/dev warn unit. / 회귀 위험: 기존 dev/e2e 가 이 구체 hex 에 의존 — 64-hex 경로와 SHA-256 derive 경로(§152-153) 모두 통과하도록 test env 점검. / spec 갱신: secret-store.md 에 "예시는 placeholder, 실값은 운영자 생성" + 거부 가드 기술 (planner).

- [ ] **M-5 refresh token 쿠키 `SameSite=None`** — `auth/utils/refresh-cookie.ts:19`
  - **spec 대조**: B — `1-auth.md §2.1` 은 "HttpOnly Cookie, 7일" 만 정의. 전체 spec 에 `SameSite` 0건 — cross-site 의도·CSRF 보완책이 spec 에 미기록 (정책 공백).
  - **개선 방안**: 1. cross-site 가 불필요한 배포(동일 상위 도메인)면 `Lax`/`Strict` — env 분기(`COOKIE_SAMESITE`). 2. cross-site 필요 시 `/auth/refresh` 에 CSRF 보호(double-submit 또는 custom header). 3. cookie `path` 를 `/api/auth` 로 축소.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `COOKIE_SAMESITE` env 분기, 기본 `Lax` (+ cookie `path` 를 `/api/auth` 로 축소 병행) | CSRF 면을 브라우저 기본 방어로 차단 — 별도 CSRF 토큰 인프라 불요. **결정 변수 확인됨: web-chat 위젯은 Bearer EIA 토큰 사용(`eia-client.ts:79` `authorization: Bearer`)으로 refresh 쿠키에 의존하지 않음** — 임베드 시나리오가 None 을 요구하지 않음. env 분기로 cross-site 배포 escape hatch 유지 | 프론트와 API 가 사이트 경계(eTLD+1)를 달리하는 배포는 `COOKIE_SAMESITE=none` 으로 직접 전환해야 함 — 기본값 변경이라 릴리스 노트 필요. None 모드 선택 시 CSRF 보호 부재는 잔존(옵션 B 병행 필요) |
    | B. `None` 유지 + `/auth/refresh` CSRF 보호(double-submit 또는 custom header) | 모든 cross-site 배포 토폴로지 무중단 지원 | CSRF 토큰 발급·검증 인프라 신규 구현 + 프론트 연동 변경 — 비용이 가장 큼. spec(`1-auth.md §2.1`)에 cross-site 의도 자체가 미기록(B 판정)인데 그 토폴로지를 전제로 투자하는 순서 역전 |
    | C. cookie `path` 축소만 (`/` → `/api/auth`, SameSite=None 유지) | 변경 최소 — CSRF 표적을 refresh 엔드포인트로 한정 | refresh 자체가 가장 민감한 표적이라 실질 위험 감소 미미 — None+HttpOnly 쿠키가 cross-site 요청에 계속 자동 첨부됨. 방어 아닌 표면 정리 수준 |
    | D. 일괄 `Strict` 고정 | 방어 최강 | OAuth redirect 복귀 등 top-level navigation 직후 첫 요청에서 쿠키 미첨부 가능 — Lax 대비 정상 플로우 파손 위험만 늘고 CSRF 방어 이득은 미미 |
  - **권장**: A — 유일한 None 의존 후보였던 web-chat 임베드가 쿠키가 아닌 Bearer 토큰 기반임이 코드로 확인되어, None 을 기본값으로 유지할 근거가 없다. Lax 기본 + env 분기는 CSRF 토큰 인프라(B) 없이 브라우저 수준 방어를 얻는 최저비용 안이고, path 축소는 부수 비용이 0 이라 병행한다. spec `1-auth.md §2.1/2.3` 에 SameSite 정책 명시(planner)가 동반돼야 한다.
  - 검증: 모드별 정상 refresh + cross-site CSRF 거부 e2e. / 회귀 위험: **web-chat 위젯 등 cross-site 임베드가 None 에 의존하면 세션 끊김** — 임베드 시나리오 확인 필수. / **spec 갱신: 필요** — `1-auth.md §2.1/2.3` 에 SameSite 정책·CSRF 보완책 명시 (현재 완전 공백, planner).

- [ ] **M-6 WS `workflow:`·`notifications:` 채널 authorizer 부재 — spec 자체가 갭** — `websocket.gateway.ts:100-150`
  - **spec 대조**: **C** — 코드는 spec 정합: `6-websocket-protocol.md §3.3:141` 이 "`execution:`/`kb:`/`background:run:` 3채널만 소유 검증" 으로 명시 — **spec 자체가 IDOR 갭을 담은 케이스**. `workflow:` 는 emit 경로가 실존(에디터 실행 알림)해 타 workspace workflowId 추측 시 이벤트 수신 가능. `notifications:` 는 emit 미구현(§725 Planned)이라 현재 실피해 0 — 단 emit 도입 시 사용자간 알림 누출 즉시 현실화.
  - **개선 방안**: 1. `channelAuthorizers` 에 `workflow:` authorizer 추가 — workflowId→workspace 소유 검증(`execution:` 동형). 2. `notifications:<userId>` authorizer — JWT sub 일치 검증(user 단위) — **emit 구현 전 선제 차단**. 3. OCP 구조라 배열 항목 추가만으로 격리적.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `workflow:` + `notifications:` authorizer 동시 추가 (spec §3.3 갱신 동반) | `workflow:` 는 emit 실존 — 타 workspace workflowId 추측 IDOR 즉시 차단. `notifications:` 는 JWT sub 일치 검증이라 구현이 자명(수 줄)하고, emit 도입(§725 Planned) 시 누락 재발 위험을 선제 제거. OCP 구조라 `channelAuthorizers` 배열 2항목 추가로 격리적 — 한 PR·한 spec 개정으로 종결 | notifications 는 현재 실피해 0 인 채널에 대한 선행 투자 — 단 비용이 수 줄 수준이라 실질 부담 미미. emit 구현 시점에 검증 로직 재확인 1회 필요 |
    | B. `workflow:` 만 즉시, `notifications:` 는 emit 구현 시점에 | 실피해 있는 채널만 우선 — 최소 변경 | 동일 파일·동일 패턴 작업을 2회로 분할 — spec §3.3 도 2회 개정. emit 구현 plan 이 authorizer 추가를 기억해야 하는 프로세스 의존 — 본 백로그가 지적한 "enforcement 비대칭이 갭으로 남는" 패턴 재생산 위험 |
    | C. 현상 유지 (spec 정합이므로) | 무비용 | spec 자체가 IDOR 갭을 담은 케이스(C 판정) — 코드-spec 정합이 안전을 의미하지 않음. `workflow:` 이벤트 수신 IDOR 방치 |
  - **권장**: A — `workflow:` 는 실존 emit 에 대한 IDOR 라 즉시 막아야 하고, `notifications:` 까지 같은 PR 에 묶는 추가 비용이 JWT sub 비교 수 줄에 불과한 반면 분할(B)의 비용은 spec 2회 개정 + 누락 재발 위험이다. "emit 없을 때 authorizer 먼저" 가 fail-closed 원칙과도 부합한다. §3.3 검증 채널 목록 2채널 추가 + notifications 의 user 단위 명시(planner) 동반.
  - 검증: 타 workspace workflowId / 타 userId 구독 거부 e2e (기존 IDOR 테스트 패턴 재사용). / 회귀 위험: 정상 경로 무영향, 비-UUID workflowId 처리 확인. / **spec 갱신: 필요** — §3.3 검증 채널 목록에 2채널 추가 + notifications 는 user 단위 명시 (planner).

- [ ] **M-7 `MCP_ALLOW_INSECURE_URL=true` 프로덕션 fail-fast 가드 없음 — enforcement 비대칭** — `mcp-client.service.ts:16-27`
  - **spec 대조**: **C** — `11-mcp-client.md:132-137` 이 "운영 환경에서 **절대 활성화해서는 안 된다**" 를 명문화했으나 부팅 강제는 미기술 — spec 의도(절대 금지) ↔ 코드(silent 허용) 괴리. OAUTH/LLM stub·EIA 토큰은 fail-closed throw 가 있는 것과 비대칭.
  - **개선 방안**: 1. `main.ts` 가드에 `production && MCP_ALLOW_INSECURE_URL=true → throw` 추가 — C-1·M-4 와 단일 가드 블록. 2. **`ALLOW_PRIVATE_HOST_TARGETS` 는 분리 처리**: self-host 정당 용도(spec §104)가 있어 throw 가 아닌 **warn** 이 적절 — 정책 구분.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `production && MCP_ALLOW_INSECURE_URL=true → throw` 를 C-1·M-4 단일 가드 블록에 추가 (`ALLOW_PRIVATE_HOST_TARGETS` 는 warn 으로 분리) | spec 의도("절대 활성화해서는 안 된다", `11-mcp-client.md:132-137`)를 enforcement 로 일치 — OAUTH/LLM stub·EIA 가드와 비대칭 해소. 정당 용도가 있는 플래그(warn)와 절대 금지 플래그(throw)의 정책 구분이 명시적 | prod 에서 (잘못) 켜둔 기존 배포는 부팅 실패 — 단 spec 이 절대 금지한 상태이므로 실패가 올바른 동작. 릴리스 노트 경고 필요 |
    | B. throw 대신 warn 로그 | 기존 배포 무중단 | spec 의 "절대 금지" 와 enforcement 불일치 지속 — warn 은 평문 MCP URL(자격증명 평문 전송 면)을 silent 허용하는 현 상태와 실질 차이 미미. 동형 stub 가드들(throw)과 비대칭 잔존 |
    | C. 현상 유지 (문서만) | 무비용 | spec 의도 ↔ 코드 괴리(C 판정) 방치 — 운영 실수 한 번이 그대로 prod 에 도달 |
  - **권장**: A — "절대 금지" 가 spec 에 명문화된 플래그는 throw 가 유일하게 정합한 enforcement 이고, 동형 가드 블록(C-1·M-4)에 1줄 추가라 비용이 최소다. 정당 용도가 spec 에 기록된 `ALLOW_PRIVATE_HOST_TARGETS` 를 warn 으로 분리하는 정책 구분이 핵심 — 이를 §132 에 명시(planner)해 이후 플래그 추가 시 분류 기준으로 삼는다.
  - 검증: prod+플래그 부팅 거부 unit, dev 통과. / 회귀 위험: prod 에서 (잘못) 켜둔 기존 배포 부팅 실패 — 릴리스 노트 경고. / spec 갱신: §132 에 "production fail-closed (stub 동형)" + ALLOW_PRIVATE_HOST_TARGETS 는 warn 정책 구분 기술 (planner).

## Minor

- [ ] **m-1 web-chat HTML sanitize — `ALLOWED_TAGS` 화이트리스트 미적용** — `channel-web-chat/src/lib/safe-html.ts:64-70`
  - **spec 대조**: D — `7-channel-web-chat/4-security.md:34` 는 "XSS 방지 sanitize + rel=noopener" **결과만** 요구 (방식 미규정) — 현 블랙리스트도 spec 충족, 화이트리스트는 추가 하드닝. rel=noopener 는 hook 으로 이미 충족.
  - **개선 방안**: 1. `ALLOWED_TAGS`/`ALLOWED_ATTR` 화이트리스트 전환(채팅 렌더 필요 태그만). 2. `ALLOWED_URI_REGEXP` 로 href scheme 제한(http(s)/mailto — javascript: 이중 방어).
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `ALLOWED_TAGS`/`ALLOWED_ATTR` 화이트리스트 전환 + `ALLOWED_URI_REGEXP` scheme 제한 | 미지·신규 벡터(svg/math 기반 mXSS 등)를 기본 차단 — sanitizer 의 표준 권장 형태. 채팅 렌더는 필요 태그가 좁아 화이트리스트 유지 비용이 낮음. javascript: scheme 이중 방어 | 실사용 태그 누락 시 렌더 깨짐 — 마크다운 렌더러 출력 태그 audit 선행 필수(백로그 명시). spec 은 결과만 요구(D 판정)라 의무는 아님 — 순수 하드닝 투자 |
    | B. 현행 블랙리스트(FORBID 류) 유지 | 무비용, 현 spec(`4-security.md:34` "XSS 방지 sanitize" 결과 요구) 충족 | 차단 목록에 없는 새 벡터가 기본 통과 — sanitize 정책이 공격 기법 변화를 따라가야 하는 유지보수 방향 역전. 임베드 위젯 특성상 XSS 피해가 호스트 사이트로 전파 |
  - **권장**: A — 임베드 위젯은 XSS 성공 시 피해가 위젯을 심은 호스트 사이트 전체로 번지는 위협 모델이라, "결과만 충족" 보다 deny-by-default 가 합당하다. 채팅 렌더에 필요한 태그 집합이 작아 audit·유지 비용이 낮고, 회귀는 사용 태그 audit + 렌더 회귀 테스트로 통제된다.
  - 검증: 화이트리스트 외 태그(svg/math) 제거 + 정상 마크다운 렌더 유지 회귀. / 회귀 위험: 실사용 태그 누락 시 렌더 깨짐 — 사용 태그 audit 후 목록 확정. / spec 갱신: 선택("화이트리스트 권장" 1줄).

- [ ] **m-2 비프로덕션 `NODE_ENV` 에서 error.stack 응답 노출** ⚠️ **(A — spec 명시 정책, 위험 낮음)** — `code.handler.ts:309-321`
  - **spec 대조**: **A** — `2-code.md §5.3` 표가 "`NODE_ENV !== 'production'` 일 때만 노출" 을 명문화 — 코드 정합. 잔여 갭은 spec 의 prod/non-prod 이분법이 staging 을 다루지 않는 운영 가이드 공백.
  - **개선 방안**: 1. (저비용) "staging 은 NODE_ENV=production 으로 운영" 가이드 명시. 2. (근본) `DEBUG_STACK_TRACES` 별도 플래그로 환경명과 디커플.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 운영 가이드 — "staging 은 NODE_ENV=production 으로 운영" 명시 | 코드 무변경 — 코드는 이미 spec(`2-code.md §5.3`) 정합. 갭의 본질이 운영 가이드 공백이므로 원인에 정확히 대응. staging 이 prod 와 동일 동작이 되어 환경 차이 버그도 감소 | staging 디버깅 시 stack 미노출 — 디버깅 편의 저하. 가이드는 강제력이 없어 운영자가 어길 수 있음 |
    | B. `DEBUG_STACK_TRACES` 별도 플래그로 환경명과 디커플 | 환경명과 무관하게 노출을 명시 제어 — staging 디버깅 편의 유지 | env 플래그 1개·분기 코드 추가 + spec §5.3 의 prod/non-prod 이분법 개정 필요(planner, error-handling §6 정합) — "위험 낮음"(A 판정) 항목 대비 변경 비용 과대 |
  - **권장**: A — spec 이 명시한 정책과 코드가 이미 정합하고 위험도 낮음으로 판정된 항목이므로, 코드·spec 양쪽을 건드리는 B 는 비용 대비 과하다. 가이드 1줄(§5.3 staging 권고)로 공백을 메우고, staging 에서 stack 가시성이 실무 요구로 확인되는 시점에 B 를 재검토한다.
  - 검증: 플래그 도입 시 prod 기본 생략 + on 시 노출 unit. / 회귀 위험: 낮음. / spec 갱신: §5.3 에 staging 권고 또는 플래그 정책 (planner, error-handling §6 과 정합).

- [ ] **m-3 `trust proxy 1` — Cloudflare 전제의 정기 검증 부재** ⚠️ **(A — 의도·전제 기록됨, 운영 프로세스 갭)** — `main.ts:68-77`
  - **spec 대조**: **A** — CF-Connecting-IP 1순위는 `1-auth.md §2.3`·`1-data-model.md:637` 명시, 코드 주석이 전제(origin 의 CF 외 직접 접근 차단)를 기록. 코드/spec 결함이 아닌 **운영 프로세스 갭**.
  - **개선 방안**: 1. (운영) Cloudflare Authenticated Origin Pulls(mTLS) 또는 origin 방화벽 CF IP allowlist 강제. 2. (절차) 분기별 점검 체크리스트(AOP 인증서·WAF·CF IP 대역 갱신) 인프라 문서화.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 운영/인프라 — Authenticated Origin Pulls(mTLS) 또는 origin 방화벽 CF IP allowlist + 분기별 점검 체크리스트 문서화 | 갭의 본질(코드/spec 결함이 아닌 운영 프로세스 갭, A 판정)에 정확히 대응 — 코드 무변경. AOP 는 CF 경유 강제를 암호학적으로 보장해 trust proxy 전제(CF 외 직접 접근 차단)를 실증 | 인프라 작업·정기 점검이라는 지속 운영 비용. 배포 가이드/인프라 문서 영역이라 코드 저장소 밖 산출물 관리 필요 |
    | B. 코드 변경 — CF-Connecting-IP 검증 로직(CF IP 대역 확인 등)을 앱 계층에 추가 | 인프라 미비 배포에서도 앱이 자체 방어 | CF IP 대역의 주기적 갱신을 앱이 떠안음(대역 변경 시 오차단 위험) — 인프라가 해야 할 경계 방어를 앱 계층에 중복 구현하는 계층 침범. spec 전제(`1-auth.md §2.3`)와 코드 주석이 이미 인프라 차단을 전제로 기록 |
  - **권장**: A — spec·코드 모두 "origin 직접 접근은 인프라가 차단" 전제를 명시 기록한 상태라, 앱 계층 중복 방어(B)보다 그 전제를 실제로 보장·정기 검증하는 운영 절차 수립이 정합하다. AOP(mTLS) 가 allowlist 보다 강하고 CF IP 대역 갱신 추적 부담도 없어 1순위로 권장한다.
  - 검증: CF 우회 직접 요청 거부 침투 점검. / 회귀 위험: 없음(인프라). / spec 갱신: 불요 — 배포 가이드 영역.

- [ ] **m-4 database-query 노드 Pool 캐시 — credential rotation 전파 지연** ✅ **승인(2026-06-10) — 권고안(근본: pub/sub 전파)대로 진행 확정** — `database-query.handler.ts:345-376`
  - **spec 대조**: **A** — `2-database-query.md:77` "credential 회전 시 stale 풀 evict 후 새 풀 생성" — 단일 프로세스 동작은 spec 정합. **멀티 인스턴스 캐시 무효화 조율은 spec 미언급** — 침해 대응(MTTR) 맥락에서 회전된 자격증명의 idle 연결이 타 인스턴스에 잔존.
  - **개선 방안**: 1. (근본) integration 업데이트 이벤트 pub/sub(Redis) 전파 → 전 인스턴스 해당 integrationId 풀 즉시 evict. 2. (단기) `POOL_IDLE_TIMEOUT_MS`(현 30s) 를 대응 SLA 에 맞게 하향 검토(연결 churn 트레이드오프).
  - **옵션 비교** (✅ 2026-06-10 사용자 승인 — A 확정):
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. **(확정)** integration 업데이트 이벤트 pub/sub(Redis) 전파 → 전 인스턴스 즉시 evict | 회전 즉시 전 인스턴스에서 stale 자격증명 연결 제거 — 침해 대응 MTTR 최소화. pub/sub 미수신 시에도 기존 credsHash evict 로 안전 degrade(fail-safe). 연결 churn 부작용 없음 | Redis pub/sub 채널·구독 코드 신규 — 멀티 인스턴스 인프라 의존 명시화. spec §2 에 멀티 인스턴스 무효화 + Rationale 추가 필요(planner) |
    | B. `POOL_IDLE_TIMEOUT_MS`(현 30s) 하향 | 코드 변경 최소(설정값) | 시간 기반 완화일 뿐 즉시성 없음 — 하향할수록 연결 churn 증가(풀 캐시 목적 훼손)와 MTTR 의 직접 트레이드오프. 활성 사용 중 연결은 idle 타이머에 안 걸림 |
  - **권장**: A (사용자 승인 확정안) — 위협 맥락이 침해 대응(회전된 자격증명의 잔존 연결 차단)이라 시간 기반 완화(B)로는 SLA 를 보장할 수 없고, B 의 churn 비용은 풀 캐시 존재 이유와 상충한다. pub/sub 실패 시 기존 credsHash evict 로 degrade 되는 fail-safe 구조라 도입 리스크도 낮다.
  - 검증: 인스턴스 A 회전 → B 풀 N초 내 무효화 통합 테스트. / 회귀 위험: pub/sub 미수신 시 기존 credsHash evict 로 안전 degrade. / spec 갱신: §2 에 멀티 인스턴스 무효화 + Rationale(MTTR 트레이드오프) 추가 (planner).
