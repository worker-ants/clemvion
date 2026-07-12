# RESOLUTION — 위젯 chrome EN i18n 코드 리뷰 (16_15_51)

> ai-review SUMMARY: RISK MEDIUM, CRITICAL 0(보고) / WARNING 6. **단 3 checker(requirement·maintainability·user_guide_sync)가 disk-write gap** 으로 유실 → journal.jsonl 복구 결과 **requirement 가 CRITICAL 1건 발견**(SUMMARY 의 "CRITICAL 0" 은 거짓 음성). 복구본은 각 `<checker>.md` 로 영속화.

## 조치 항목

| # | Checker | 심각도 | 발견 | 조치 |
|---|---|---|---|---|
| C1 | requirement(복구) | **CRITICAL** | `widget-app.tsx` `useMemo(…, [config?.locale])` 가 locale 을 config.locale 변화에 반응시켜 **wc:boot 재전송만으로 UI 언어가 바뀜** — spec 3곳(2-sdk §3·1-widget §4·admin §6.1) + 코드 주석이 명문화한 "boot 1회 고정, 변경은 재마운트로만" 계약 위반 | **`useRef` 로 첫 boot 시 1회 고정**(이후 config.locale 변화 무시). 회귀 테스트 추가(동일 인스턴스 2차 wc:boot 다른 locale → 언어 불변) |
| W1 | scope/documentation | WARNING | `doc-sync-matrix.json` 전체가 compact→pretty 재포맷돼 diff 노이즈(208줄) | 원본 복원 후 신규 1행만 **원 compact 스타일**로 `new-ui-string` 다음에 삽입(11+/0−) |
| W2 | side_effect | WARNING | `panel.tsx` 에러 렌더가 state.error 실제값과 분리(표시=고정 키) — 불변식 미강제 | 렌더 사이트 주석으로 불변식 명시("렌더되는 에러는 항상 generic, BLOCKED 코드는 미렌더") + **원값 미노출 검증 테스트 추가**(state.error="raw" → alert 는 generic) |
| W3 | side_effect | WARNING | `BootConfig.locale` reserved→active 로 기존 저장 `locale='en'` 인스턴스가 배포 즉시 EN 렌더(배포-시점 동작 변화) | 코드 아님 — **CHANGELOG Unreleased 에 배포 영향 명시** |
| W4 | documentation | WARNING | `CHANGELOG.md` 미갱신 | Unreleased 절 추가(범위·우선순위·배포영향·SoT) |
| W5 | documentation | WARNING | `channel-web-chat/README.md ## 상태` 에 신규 i18n 모듈 누락 | "chrome 문자열 ko/en i18n(`src/lib/i18n`)" 항목 추가 |
| W6 | documentation | WARNING | `use-widget.ts` `GENERIC_ERROR_MESSAGE` JSDoc("사용자 노출용")과 신규 주석("내부 신호") 상충 | JSDoc 을 "내부 ko 신호, 표시는 panel 이 catalog 로케일 렌더"로 통일 |

## 참고(INFO) 반영
- testing INFO 8(panel 에러 렌더 직접 단언) → W2 조치에 포함(테스트 추가).
- requirement INFO(§2 목표/비목표 배치) → 문서 정리 사항, 기능 무영향 — 후속 spec 정리로 이관(아래).
- 나머지 INFO(security 4·side_effect Object.freeze·testing 나머지·doc-sync 위치)는 조치 불요/선택 — security 는 XSS/ReDoS 없음 확인, catalog 는 `as const` 로 컴파일타임 불변.

## 보류·후속 항목
- `_product-overview §2` 신규 목표를 "비목표" 블록 예외 문구가 아닌 "목표 (v1)" 목록으로 실제 이동(requirement INFO) — 기능 무영향 문서 구조 정리, 별도 정리 PR 또는 후속.
- `2-sdk §1` 스니펫 예시에 `locale: 'en'` 노출(documentation INFO 13) — 선택.

## TEST 결과 (CRITICAL·WARNING fix 후 재수행)
- lint: PASS (0 errors, 1 warning — pre-existing `fetchMock` unused, origin/main 동일, 본 변경 무관)
- unit: PASS
- build: PASS
- e2e: PASS (253 passed) — 변경은 channel-web-chat client 한정이나 화이트리스트 밖이라 backend e2e 수행
