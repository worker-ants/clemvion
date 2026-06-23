# Code Review 통합 보고서 (rebase 후 재리뷰)

리뷰 대상: webchat-console 증분 3 — origin/main 대비 전체 피처(rebase 후 freshness 복구용 재리뷰)
리뷰 일시: 2026-06-24 08:27:11

> 통합 summary 의 terminal write 가 차단되어 main 이 멱등 persist. 상세는 동일 디렉터리 `<reviewer>.md` 참조.

## 전체 위험도

**MEDIUM** — 테스트 커버리지 결함(WARNING 4건)과 보안 트레이드오프(WARNING 3건) 공존. Critical 없음.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 보안 | `allow-same-origin`+`allow-scripts` sandbox 조합 — 동일 origin 악성 스크립트 sandbox 탈출 가능 | `4-security §1`, `live-preview.tsx` | 트레이드오프·외부 CDN cross-origin 해소 명시 |
| W-2 | 보안 | `endpointPath` 클라 생성값의 서버측 UUID 형식·중복 검증 미명시 | `5-admin-console §3` | UUID 검증·unique·409 spec 명시 |
| W-3 | 보안 | `/embed-config` `public` 캐시 — allowlist 축소 시 TTL(5분) 동안 통과 | `4-security §3-①` | fail-open·캐시 성격 경고 |
| W-4 | 테스팅 | `useAppearanceDraft` localStorage persist round-trip 미테스트 | `use-appearance-draft.test.ts` | round-trip 단언 추가 |
| W-5 | 테스팅 | `LivePreview` endpointPath/locale 변경 시 iframe 재마운트 미테스트 | `live-preview.test.tsx` | 재마운트 검증 추가 |
| W-6 | 테스팅 | `EmbedConfigService` workspace null(삭제) 케이스 미테스트 | `embed-config.service.spec.ts` | fail-open 안전반환 테스트 |
| W-7 | 테스팅 | appearance silent-delete(PATCH 시 생략) 동작 미문서화 테스트 | `triggers.web-chat.spec.ts` | 의도된 동작 검증 추가 |
| W-8 | 문서화 | i18n 파일명 §8 `web-chat.ts` vs 실제 `webChat.ts` | `5-admin-console §8` | (이미 webChat.ts 로 반영됨) |
| W-9 | 문서화 | `getWidgetLoaderUrl()` SoT 미기재 | `5-admin-console §5` | (이미 SoT 추가됨) |
| W-10 | 요구사항 | `status: implemented` 조기 설정 우려 | `5-admin-console` frontmatter | spec-status-lifecycle 가드가 pending_plans 비면 implemented 강제 |
| W-11 | 유지보수 | `InteractionTokenStrategy` 에 spec 배제된 `per_trigger` 잔류 | `use-web-chat.ts`, `interaction-config.dto.ts` | 의도 주석/별칭 |
| W-12 | 유지보수 | `suggestions` flat↔array 변환 책임 서버 DTO 미명시 | `web-chat-appearance.dto.ts` | JSDoc SoT 명시 |

## 참고 (INFO) — 요약 (상세 reviewer 파일)

I-1~I-5 보안(postMessage 신뢰 전제·자유텍스트 길이/escape·primaryColor 재검증·silent-delete 감사로그·JSONB SQLi 바인딩 확인), I-6~I-11 요구사항/범위(0-overview §6.2 증분2 표현·embed-config 헤더 적용 확인·_retry_state 상태·세션 부분누락·커밋 메시지·plan 링크 선참조), I-12~I-18 부작용/유지보수(enabled 하드코딩·localStorage orphan·sidebar 인덱스·WorkflowOption export·MAX_LIST_LIMIT 공유·PREVIEW 상수 주석·JSON 개행).

## 처리

- **Critical 0** → 차단 없음. **rebase freshness 복구용 재리뷰**(코드 무변경; 직전 리뷰 02_44_56 의 9 WARNING 은 이미 fix 되어 트리에 반영됨).
- **이미 반영/dismiss**: W-1(4-security §1 트레이드오프 기재 완료)·W-8(webChat.ts)·W-9(SoT)·W-10(가드가 implemented 강제).
- **spec 보완(fix, 코드 무변경)**: W-2(§3 endpointPath 서버검증 명시)·W-3(§3-① 캐시 fail-open 주의).
- **defer(후속 테스트/주석 강화, 비차단)**: W-4·W-5·W-6·W-7(테스트 갭)·W-11·W-12(주석)·INFO 다수. RESOLUTION.md 에 등록.
