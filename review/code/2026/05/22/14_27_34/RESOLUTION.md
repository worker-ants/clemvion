# RESOLUTION — 14_27_34

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 (testing) | 코드 | f0c515b1 | isError 분기: mockRejectedValueOnce + loadFailed 메시지 검증 케이스 추가 |
| W-2 (testing) | 코드 | f0c515b1 | onClose 콜백 호출 검증 케이스 추가 (Dialog X버튼·sr-only "Close" span 공존으로 getAllByRole 대신 textContent 필터링) |
| W-3 (testing) | 코드 | f0c515b1 | open=false 시 API 미호출 케이스 추가 (enabled: !!triggerId && open 조건 검증) |
| W-4 (security) | 정당화 (코드 변경 없음) | — | spec §2.1 + Rationale R-6 "모든 역할 가시" 명시 — 의도된 design. viewer 도 워크플로 운영 모니터링용으로 호출 이력 필요. 백엔드 GET /api/triggers/:id/history 가 workspace 소속 검증으로 IDOR 차단 중이므로 UI 가드 불필요. |
| INFO-4 (requirement) | 코드(plan) | f0c515b1 | plan 체크박스 [ ] → [x] 완료 표기 갱신 |
| INFO-5 (requirement) | 코드(plan) | f0c515b1 | plan historyTrigger → historyTarget 정정 (구현 변수명 일치) |
| INFO-9 (maintainability) | 코드 | f0c515b1 | HISTORY_LIMIT = 10 상수 추출 — 컴포넌트 상단 선언, limit 인라인 리터럴 교체 |
| INFO-14 (testing) | 코드 | f0c515b1 | triggers-page.test.tsx 에 TriggerHistoryDialog null mock 추가 (테스트 격리성) |
| INFO-17 (documentation) | 코드 | f0c515b1 | open/onClose Props JSDoc 추가 (enabled 조건·핸들러 역할 명시) |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4448 passed)
- e2e   : 통과 (98/98)

## 보류·후속 항목

다음 항목은 본 PR 범위 밖이거나 별도 사이클에서 처리하는 것이 적합한 INFO 항목이다.

- INFO-1/2/3 (security): URL UUID 검증, useT XSS 위험, entry.status 화이트리스트 — 실질 위험도 낮음(backend trust + React 기본 이스케이프). 별도 plan으로 추적 권장.
- INFO-6/7 (requirement): spec §2.3 응답 코드 회색지대, TriggerHistoryEntry.status 열린 타입 — spec §2.1+R-6 범위 명확화 필요. project-planner 위임.
- INFO-10/11/12/13 (maintainability): TriggerHistoryTarget 타입 추출, 복합 삼항 분리, 로딩 aria-label, onOpenFullDetail 클로저 주석 — 다음 정비 사이클.
- INFO-15/16 (testing): rerender QueryClient 공유 패턴 주석, status:"error"/outline badge 케이스 — 기술 부채 추적.
- INFO-18 (scope): Create Webhook Dialog 인라인 → 별도 파일 분리 — 현 PR 범위 외.
- INFO-19 (changelog): 프로젝트에 CHANGELOG 자체 부재 — N/A.
- INFO-20 (scope): developer 가 spec 직접 수정 (§2.1 한 줄 + R-6 단락). 커밋 메시지에 의식적 skip 근거 기록됨 — spec drift 정정으로 합리적.
- INFO-21 (user guide): /triggers 관리 화면 전용 가이드 페이지 부재 — 본 PR 무관. 별도 plan.
