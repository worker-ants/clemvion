# RESOLUTION — URI-userinfo SoT 통합 ai-review

| 출처 | Severity | 처분 |
|---|---|---|
| security | INFO(stale JSDoc) | **Fixed** — `redactMcpSecrets` JSDoc(mcp-error-codes.ts:63-66) 을 "공용이 userinfo/JWT 커버, MCP 전용은 bare token만"으로 정정(`b48d4c10b`). |
| testing | INFO(coverage) | **Fixed** — password 콜론 포함 케이스(`https://admin:pa:ss@host`) 마스킹 pin 테스트 추가. |
| security | INFO(그 외) | scheme 신규 노출(의도·문서화), 선재 FN/over-mask(본 diff 무관), ReDoS 없음·behavior-preserving 실측 확인 — 조치 불필요. |

## 검증
- unit: 전 소비처 34 suite/795(+ 리뷰어 보충 209·883) 통과, lint 0 error, build clean.
- **e2e: 249 pass**.
