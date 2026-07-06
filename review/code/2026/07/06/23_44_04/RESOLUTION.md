# RESOLUTION — delta 리뷰 (23_44_04, 656fc7cce..HEAD)

## 조치 항목
| # | WARNING | 조치 | 파일 |
|---|---|---|---|
| 1 | testing — sanitizer 적용 회귀 가드 부재 | dispatchExecutionFailedNotification 에 connection-string 메시지 전달 → 알림 message 가 `[REDACTED_URI]` 포함·원본 URI/secret 미포함 단언 unit 추가 | execution-engine.service.spec.ts |
| 2 | documentation — finalizeResumedExecutionOutcome JSDoc | dispatch side-effect(execution_failed 발사, best-effort, §1.1) 한 줄 추가 | execution-engine.service.ts |

## INFO 처리
- security INFO#2(새니타이저 스킴 커버리지 한계): 선존 한계, 이번 diff 악화 없음 → followup 후보(우선순위 낮음). CHANGELOG(INFO#7)·전용 sanitizer spec(INFO#4): 선택, 미착수.

## TEST 결과
- lint / unit / build: 통과 (신규 sanitizer redact unit 포함).
- e2e: 통과 — 런타임 변경은 JSDoc(주석) 뿐이라 직전 green(238 pass)과 동일 런타임, .spec.ts 추가분 정책 준수 재수행.

## 보류·후속
- 아키텍처 부채(DI 순환)·FAILED 종결 헬퍼 추출·spec §4.4 ModuleRef 문서화: `notif-hardening-followups.md` §후속 체크박스로 추적(별도 트랙).
