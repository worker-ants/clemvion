---
worktree: pr4b-kb-embedding-retire
started: 2026-06-12
owner: resolution-applier
---
# Spec Fix Draft — resolveEmbedding vs resolveConfig 에러코드 라우팅 명시

## 분류
spec 결함 (spec 내부 두 문서의 기술이 상충하며, 의도적 설계 차이가 Rationale 에 기술되지 않음)

## 원본 발견사항

- **SUMMARY W-1** (spec 내부 불일치): `8-embedding-pipeline.md §5.5` 는 ws-default 부재 시
  `MODEL_CONFIG_NOT_FOUND`(404) 를 기술하고, `3-error-handling.md §1.3` 은
  `MODEL_CONFIG_DEFAULT_MISSING`(400) 을 기술 — 동일 시나리오처럼 보이지만 실제로는
  **의도적으로 다른 경로**임이 spec 에 명시되지 않음.
- **SUMMARY I-4** (API 계약): `spec/2-navigation/5-knowledge-base.md` 에 ws default 부재 시
  `MODEL_CONFIG_NOT_FOUND` 로 기술됨 — `3-error-handling.md §1.3` 의 `MODEL_CONFIG_DEFAULT_MISSING`
  분리와 불일치. UI 에러 안내 혼선 가능.

## 근거 (사용자 결정 #2, 2026-06-12)

두 경로는 의도적으로 다른 에러코드를 사용한다:

- `resolveEmbedding` ws-default 부재: `MODEL_CONFIG_NOT_FOUND`(404) — KB 임베딩 경로에서
  ws default embedding config 자체가 없는 것은 "리소스 부재"로 취급. KB 생성·검색 요청을
  차단하는 "hard stop". 응답 의미: "지금 이 KB 에 대한 임베딩을 resolve 할 수 없음 (config 없음)".
- `resolveConfig` (chat LLM) ws-default 부재: `MODEL_CONFIG_DEFAULT_MISSING`(400) — 채팅 default
  config 미설정은 "setup 요구" 안내용. 응답 의미: "워크스페이스 설정에서 default 모델을 지정하세요".

현재 `3-error-handling.md §1.3` 에서 `MODEL_CONFIG_DEFAULT_MISSING` 발행 경로를 `resolveConfig`
ws default 경로만으로 제한하고, `resolveEmbedding` 는 명시하지 않았다. 이 의도적 차이가
명시되어야 W-1/I-4 가 완전히 해소된다.

## 제안 변경

### 1. `spec/5-system/3-error-handling.md §1.3`

`MODEL_CONFIG_DEFAULT_MISSING` 행 설명에 `resolveEmbedding` 이 `MODEL_CONFIG_NOT_FOUND`(404)를
사용함을 명시:

**Before**:
```
| `MODEL_CONFIG_DEFAULT_MISSING` | id 미지정 시 워크스페이스 default config 없음(setup 안내용)
  — `resolveConfig` 의 ws default 경로 (`model-config.service.ts` 발행) | 400 |
```

**After**:
```
| `MODEL_CONFIG_DEFAULT_MISSING` | id 미지정 시 워크스페이스 default config 없음(setup 안내용)
  — `resolveConfig` 의 ws default 경로. **`resolveEmbedding` ws-default 부재는
  `MODEL_CONFIG_NOT_FOUND`(404) 를 사용한다** — 임베딩 config 부재는 리소스 부재("hard stop")로
  처리하며, setup 안내(400)와 구분된다 (사용자 결정 2026-06-12). | 400 |
```

### 2. `spec/5-system/3-error-handling.md Rationale`

기존 Rationale 에 `MODEL_CONFIG_NOT_FOUND`(404) vs `MODEL_CONFIG_DEFAULT_MISSING`(400) 분리
섹션이 있으나(`§397-401`), `resolveEmbedding`이 404를 유지하는 이유를 추가:

**추가 문구 (Rationale 분리 섹션 말미)**:
```
resolveEmbedding 의 ws-default 부재는 `MODEL_CONFIG_DEFAULT_MISSING`(400) 이 아닌
`MODEL_CONFIG_NOT_FOUND`(404) 를 유지한다. KB 임베딩 해석 실패는 "setup 미완료 안내"가 아니라
"이 자원을 현재 resolve 할 수 없음" 으로 취급하는 것이 의미적으로 더 정확하기 때문이다.
setup 안내(400, MODEL_CONFIG_DEFAULT_MISSING)는 chat/LLM default 경로에서만 발행한다
(사용자 결정 2026-06-12).
```

### 3. `spec/2-navigation/5-knowledge-base.md`

I-4: KB nav spec 에서 ws default 부재 에러코드를 `MODEL_CONFIG_NOT_FOUND`(404) 로 유지 (현재값).
단, 맥락 주석을 추가해 `3-error-handling.md §1.3` 의 `MODEL_CONFIG_DEFAULT_MISSING`(400) 과
다른 이유를 명시:

```
ws default embedding config 없음 → `MODEL_CONFIG_NOT_FOUND`(404).
  (참고: `resolveConfig`(chat default) 부재는 `MODEL_CONFIG_DEFAULT_MISSING`(400)로 분리 —
   3-error-handling.md §1.3 참조)
```
