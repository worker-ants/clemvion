# RESOLUTION — 07-dependency 잔여 8건 ai-review 후속

리뷰 위험도 **LOW** / Critical 0 / Warning 6. Critical 없음 — Warning 6건 전수 처분(수정 4 / 검증-후-비이슈 2) + INFO 1건 정리.

## 조치 항목

| # | 카테고리 | 발견 | 처분 | 근거/위치 |
|---|---|---|---|---|
| W1 | Security/레이트리밋 | TOTP verify 엔드포인트 brute-force 방지 미확인 | **비이슈(검증)** | `auth.controller.ts` 가 이미 `@Throttle({ttl:60_000, limit:5/10})` 를 2FA(login/totp·2fa/verify) 엔드포인트에 적용 중 — 변경 불요 |
| W2 | Security/로깅 | `verifyCode` 가 otplib 내부 에러 메시지를 warn 로깅(OWASP A09) | **수정** | `totp.service.ts` — 메시지 대신 `(err).name`(에러 타입명)만 로깅 |
| W3 | Testing/커버리지 | `disable()` 테스트 전무 | **수정** | `totp.service.spec.ts` — disable 초기화 테스트 추가 |
| W4 | Testing/커버리지 | `verifyAndEnable` user=null 분기 미테스트 | **수정** | `totp.service.spec.ts` — findById null → BadRequest 케이스 추가 |
| W5 | Testing/경계값 | safe-html 빈/공백 입력 경계값 미테스트 | **수정** | `safe-html.test.ts` — 빈 html/markdown·공백 markdown 3 케이스 추가 |
| W6 | Dependency/peerDep | `@vitejs/plugin-react v6` 의 vite `^8` peer 충족 미확인 | **비이슈(검증)** | channel-web-chat 의 vite 가 `8.0.16` 로 resolve(vitest4 경유) → peer `^8` 충족. build·188 unit PASS |
| INFO-7 | Maintainability | `auth.service.spec` jwtService.sign 캐스팅 불일치 | **수정** | `(jwtService.sign as jest.Mock).mock` → `jwtService.sign.mock` 통일 |

기타 INFO/SPEC-DRIFT 처분:
- SPEC-DRIFT-2 (spec §1.1 ↔ 위젯 구현 정합): §1.1 매트릭스는 기존 `safe-html.ts`(ALLOWED_TAGS/ATTR/URI_REGEXP)를 그대로 기술한 것 — drift 아님(리뷰어가 diff 에서 pre-existing 구현을 못 봤을 뿐). frontmatter `code:` 에 safe-html.ts 등재 완료.
- INFO-4 (sdk engines): `packages/sdk` 는 이미 `engines.node >=20.0.0` 보유 — 정책 반영됨.
- INFO(복구코드 SHA-256 KDF 아님): 72비트 엔트로피·일회성으로 현 설계 수용 가능(리뷰어도 동의). 변경 없음.

## TEST 결과

- **lint**: 통과 (`run-test.sh lint`)
- **unit**: 통과 — backend totp+auth 208 / channel-web-chat safe-html 21 (리뷰 픽스분 재실행), 직전 전체 unit fe 4450·be 7054·cwc 188·ee 123 PASS
- **build**: 통과 (`run-test.sh build`)
- **e2e**: 통과 — `run-test.sh e2e` 34 suites/202 tests PASS. (totp.service.ts 변경은 로그 메시지 문자열뿐이라 2FA 거동 불변이나 코드 변경이므로 재수행.) 1차 시도는 Docker VM 디스크 부족(build cache 33GB)으로 postgres initdb 실패 → `docker builder/image prune` 회수 후 통과. backend jest open-handle quirk 로 runner self-exit 안 함 → 결과 확인 후 `make e2e-down`.

## 보류·후속 항목

없음. 모든 Warning 은 본 PR 내에서 처분(수정 또는 검증-후-비이슈).
