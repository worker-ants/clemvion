---
worktree: unified-model-mgmt-5af7ee
started: 2026-06-11
owner: resolution-applier
---
# Spec Update Draft — model-config defaultParams defaults

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — 구현이 spec 을 의도적으로 개선한 경우

## 원본 발견사항
SUMMARY#INFO10 (WARNING#10 in caller context): `formMaxTokens` 기본값 `4096` — spec §B.4 기본값 `2048` 과 불일치 (구 코드 계승)

## 검증 결과
- `codebase/frontend/src/components/models/model-config-manager.tsx`: `DEFAULT_MAX_TOKENS = 4096`
- 이전 `codebase/frontend/src/app/(main)/llm-configs/page.tsx` (PR3 이전 구 파일): 동일 `4096` 사용
- spec `spec/2-navigation/6-config.md §B.4`: `max_tokens 기본값 = 2048`

두 코드베이스 모두 `4096` 을 일관되게 사용. `2048` 은 코드에서 한 번도 적용된 적 없다.
이는 코드가 먼저 결정되고 spec 이 낡은 경우(SPEC-DRIFT). 4096은 대부분 현대 모델에서 안전한 최소 출력 컨텍스트이며 UX 상 합리적이다.

## 제안 변경

**위치**: `spec/2-navigation/6-config.md §B.4`

### Before
```markdown
### B.4 모델 파라미터 기본값
...
| max_tokens | 최대 출력 토큰 수 | 2048 |
```

### After
```markdown
### B.4 모델 파라미터 기본값
...
| max_tokens | 최대 출력 토큰 수 | 4096 |
```

**근거**: 프론트엔드 구현(PR3)과 PR3 이전 구 `/llm-configs` 폼 모두 4096을 기본값으로 일관되게 사용. 현대 LLM 모델은 최소 4096 출력 토큰을 지원하므로 더 실용적이다. spec §B.4 를 실제 구현 동작에 맞춰 갱신한다.
