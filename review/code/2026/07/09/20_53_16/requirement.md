### 발견사항

- **[INFO]** WARNING 1(self-test/프로덕션 판정 로직 이중 구현) 정상 fix 확인
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:69-76` (`subGlobalTimeoutsInLine`), `:79-90` (`findSubGlobalTimeouts`가 이를 호출), `:105-124` (self-test `it.each`도 동일 헬퍼 호출)
  - 상세: 이전 리뷰(20_26_00)가 지적한 "프로덕션 스캔과 self-test 가 판정 로직을 독립 재구현해 drift 위험이 있다"는 문제를 `subGlobalTimeoutsInLine(line, global)` 단일 헬퍼로 정확히 해소했다. 직접 `pnpm vitest run src/__tests__/e2e-no-sub-global-timeout.test.ts` 로 재현 실행한 결과 `11 passed (11)` — RESOLUTION.md 의 주장과 일치. 경계값 테스트(9_999 검출 vs 10_000/15_000/명명상수/무관 API 통과)도 여전히 `value < global` strict-less-than 의미를 정확히 커버.
  - 제안: 추가 조치 불필요.

- **[INFO]** WARNING 2(타이틀 오도 코드) 정상 fix 확인
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:96`
  - 상세: 이전에 `it()` 타이틀이 주석("실패 메시지에 전역값 노출")과 달리 고정 문자열 `"parsed from playwright.config.ts"` 만 보간하던 오도 코드를, 실제 `${GLOBAL}` (config 파싱값) 을 보간하도록 정정했다 — `has no bare-numeric timeout below the global expect.timeout (${GLOBAL}) in e2e specs`. 주석-코드 일치 확보.
  - 제안: 추가 조치 불필요.

- **[INFO]** INFO 3(PROJECT.md 가드 목록 등록)·INFO 4(매직넘버 주석) 정상 fix 확인
  - 위치: `PROJECT.md:262`(`### 자동 가드 (build-time 차단)` 목록에 신규 항목 추가), `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:129`(`toBeGreaterThan(10)` 위 근거 주석)
  - 상세: 신규 가드가 §자동 가드 목록의 정확한 위치(다른 build-time unit 가드들과 같은 리스트)에 등록됨을 직접 확인. `toBeGreaterThan(10)` 위에 "e2e 스펙이 최소 이 정도는 수집돼야 빈 트리에 fail-open(offender 0 위양성) 하지 않음을 보장" 주석 추가 확인.
  - 제안: 추가 조치 불필요.

- **[INFO]** WARNING 3(regex word-boundary 부재) 미변경 결정은 타당 — 재차단 대상 아님
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:31` `TIMEOUT_LITERAL`
  - 상세: 이전 두 리뷰어(requirement, testing)가 이미 "현재 위반 0건, 과탐이 CI 차단 목적상 미탐보다 안전"이라는 근거로 non-blocking 결론을 내렸고 RESOLUTION.md 에 "의도적 미채택"으로 기록돼 있다. 이번 fix commit 도 이를 그대로 유지했다. 재차 WARNING 으로 격상해 무한 fix 루프를 유발할 근거가 없다 — 이미 트레이드오프가 명시적으로 검토·기록됨.
  - 제안: 조치 불필요. 실제 오탐 사례가 나올 때만 재검토.

- **[INFO]** 동반 backend fix (`execution-engine.service.spec.ts` `service`→`svcMetrics`) 는 별도 커밋으로 정확히 격리·검증됨
  - 위치: 커밋 `7887bfb93` (`54b466d` 와 별개)
  - 상세: `git show 7887bfb93` 로 확인 — `NF-OB-07 BusinessMetrics 동작` describe 내부에서 스코프 밖 `service` 참조로 인한 `ReferenceError` 를 `svcMetrics` 로 교정한 1줄 변경이며, 커밋 메시지에 이번 e2e 가드 작업과 무관한 pre-existing 결함임을 명시했다. RESOLUTION.md/SUMMARY.md 도 이를 정확히 disclose. scope 이탈 아님.
  - 제안: 조치 불필요.

- **[INFO]** spec fidelity — 관련 `spec/` 문서 부재는 설계상 정상 (spec 누락 아님)
  - 위치: `spec/**` 전체 grep 결과 `sub-global`/`expect.timeout`/`e2e-no-sub-global-timeout` 관련 언급 0건
  - 상세: 본 변경은 제품 스펙이 아닌 e2e harness 컨벤션(`PROJECT.md §e2e 테스트 작성 가이드 → 자동 가드`)에 속하며, CLAUDE.md 의 정보 저장 위치 원칙상 "실제 명령·인프라·면제 화이트리스트·e2e 작성 패턴"의 SoT 는 `PROJECT.md` 로 명시돼 있다(`spec/conventions/`가 아님). 따라서 spec/ 부재는 결함이 아니라 설계 의도와 일치.
  - 제안: 없음 (정보성).

### 요약
이번 커밋(`54b466d`)은 직전 리뷰(20_26_00)의 WARNING 1·2 를 코드 레벨에서 정확히 해소했다 — `subGlobalTimeoutsInLine(line, global)` 단일 헬퍼로 프로덕션 스캔(`findSubGlobalTimeouts`)과 self-test 판정 로직의 drift 위험을 제거했고, `it()` 타이틀의 실제 값 보간(`${GLOBAL}`)으로 주석-코드 불일치를 바로잡았다. `pnpm vitest run` 직접 재실행으로 11/11 통과를 확인했으며, INFO 3(PROJECT.md 가드 목록 등록)·INFO 4(매직넘버 주석) 도 정확한 위치에 반영됐다. WARNING 3(regex word-boundary 부재)의 미변경 결정은 두 리뷰어가 독립적으로 검토한 "과탐이 미탐보다 CI 차단상 안전"이라는 근거가 여전히 유효해 재차단할 이유가 없다. 동반된 backend `svcMetrics` 오참조 수정은 별도 커밋(`7887bfb93`)으로 정확히 격리·disclose 됐고, 관련 `spec/` 문서 부재는 이 변경이 harness 컨벤션(SoT=PROJECT.md)이라 예상된 정상 상태다. Critical/Warning 신규 발견 없음.

### 위험도
NONE