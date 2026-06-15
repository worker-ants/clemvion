/**
 * 인증 설정 생성/편집 폼의 상태·검증·다이얼로그 제어를 단일 훅으로 통합한다.
 * 이전엔 page.tsx 에 form 관련 `useState` 11개 + `dialogMode === "edit"` 분기가
 * 흩어져 있었다 — 이를 한 곳에 모아 create/edit 컴포넌트가 동일 상태를 공유하게 한다.
 *
 * 동작은 분리 전과 동일하다: 다이얼로그를 닫을 때마다 폼이 초기화되므로 `openCreate`
 * 는 별도 초기화 없이 모드만 전환하면 된다(기존 page.tsx 와 bit-identical).
 */
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import {
  type AuthConfigType,
  type AuthConfigFormState,
  AUTH_CONFIG_DEFAULTS,
  formStateFromAuthConfig,
  validateAuthConfigForm,
} from "./auth-config-form";
import type { AuthConfig } from "./auth-config-types";

/** create: 신규 발급 / edit: 기존 config 의 non-secret 필드(name·headerName·IP 등) 수정. */
export type AuthDialogMode = "create" | "edit";

export interface UseAuthConfigForm {
  /** null = 다이얼로그 닫힘. */
  mode: AuthDialogMode | null;
  editTargetId: string | null;
  openCreate: () => void;
  /** 기존 config 의 non-secret 값으로 폼을 채워 편집 모드로 연다. */
  openEdit: (config: AuthConfig) => void;
  /** 다이얼로그를 닫고 폼을 초기화한다(기존 resetForm). */
  close: () => void;

  name: string;
  setName: (v: string) => void;
  type: AuthConfigType | "";
  setType: (v: AuthConfigType | "") => void;
  hmacHeader: string;
  setHmacHeader: (v: string) => void;
  hmacAlgorithm: "sha256" | "sha512";
  setHmacAlgorithm: (v: "sha256" | "sha512") => void;
  apiKeyHeader: string;
  setApiKeyHeader: (v: string) => void;
  ipWhitelist: string;
  setIpWhitelist: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  generatedKey: string | null;
  setGeneratedKey: (v: string | null) => void;

  collectFormState: () => AuthConfigFormState;
  validateAndProceed: (
    onValid: () => void,
    options?: { requireType?: boolean; requirePassword?: boolean },
  ) => void;
}

export function useAuthConfigForm(): UseAuthConfigForm {
  const t = useT();
  const [mode, setMode] = useState<AuthDialogMode | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AuthConfigType | "">("");
  // type 별 추가 입력 (hmac: header/algorithm, basic_auth: username/password).
  const [hmacHeader, setHmacHeader] = useState<string>(
    AUTH_CONFIG_DEFAULTS.hmacHeader,
  );
  const [hmacAlgorithm, setHmacAlgorithm] = useState<"sha256" | "sha512">(
    AUTH_CONFIG_DEFAULTS.hmacAlgorithm,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // api_key 전용 헤더 이름 (default X-API-Key) + 모든 type 공통 IP 화이트리스트
  // (한 줄에 IP/CIDR 하나). 백엔드 DTO 는 config.headerName / top-level ipWhitelist 지원.
  const [apiKeyHeader, setApiKeyHeader] = useState<string>(
    AUTH_CONFIG_DEFAULTS.apiKeyHeader,
  );
  const [ipWhitelist, setIpWhitelist] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  function close() {
    setName("");
    setType("");
    setHmacHeader(AUTH_CONFIG_DEFAULTS.hmacHeader);
    setHmacAlgorithm(AUTH_CONFIG_DEFAULTS.hmacAlgorithm);
    setApiKeyHeader(AUTH_CONFIG_DEFAULTS.apiKeyHeader);
    setIpWhitelist("");
    setUsername("");
    setPassword("");
    setGeneratedKey(null);
    setEditTargetId(null);
    setMode(null);
  }

  function openCreate() {
    setMode("create");
  }

  function openEdit(config: AuthConfig) {
    const s = formStateFromAuthConfig(config);
    setName(s.name);
    setType(s.type);
    setApiKeyHeader(s.apiKeyHeader);
    setHmacHeader(s.hmacHeader);
    setHmacAlgorithm(s.hmacAlgorithm);
    setUsername(s.username);
    setPassword("");
    setIpWhitelist(s.ipWhitelistRaw);
    setGeneratedKey(null);
    setEditTargetId(config.id);
    setMode("edit");
  }

  // 폼 상태 단일 수집 지점 — 검증(validateAndProceed)·페이로드 조립(mutation)이
  // 동일 객체를 공유해 필드 추가 시 한 곳만 수정하면 된다. `type` 은 호출 전
  // 비어있지 않음이 보장된다(handleCreate 가드).
  function collectFormState(): AuthConfigFormState {
    return {
      name,
      type: type as AuthConfigType,
      apiKeyHeader,
      hmacHeader,
      hmacAlgorithm,
      username,
      password,
      ipWhitelistRaw: ipWhitelist,
    };
  }

  /**
   * name 공백·basic_auth username·validateAuthConfigForm·toast 처리를 공유.
   * 검증 통과 시 `onValid()` 를 호출한다.
   * `requirePassword` — create 모드에서만 true (edit 에서는 password 입력란 없음).
   */
  function validateAndProceed(
    onValid: () => void,
    options: { requireType?: boolean; requirePassword?: boolean } = {},
  ) {
    const { requireType = false, requirePassword = false } = options;
    if (!name.trim() || (requireType && !type)) {
      toast.error(t("authentication.fillRequired"));
      return;
    }
    if (type === "basic_auth") {
      if (!username.trim()) {
        toast.error(t("authentication.fillRequired"));
        return;
      }
      if (requirePassword && !password) {
        toast.error(t("authentication.fillRequired"));
        return;
      }
    }
    // §A.2 입력 형식 검증 — 잘못된 헤더명/IP·CIDR 는 제출 차단(백엔드 도달 전).
    const validationError = validateAuthConfigForm(collectFormState());
    if (validationError) {
      if (validationError.key === "invalidIpWhitelist") {
        toast.error(
          t("authentication.invalidIpWhitelist", {
            entries: validationError.invalid.join(", "),
          }),
        );
      } else {
        toast.error(t("authentication.invalidHeaderName"));
      }
      return;
    }
    onValid();
  }

  return {
    mode,
    editTargetId,
    openCreate,
    openEdit,
    close,
    name,
    setName,
    type,
    setType,
    hmacHeader,
    setHmacHeader,
    hmacAlgorithm,
    setHmacAlgorithm,
    apiKeyHeader,
    setApiKeyHeader,
    ipWhitelist,
    setIpWhitelist,
    username,
    setUsername,
    password,
    setPassword,
    generatedKey,
    setGeneratedKey,
    collectFormState,
    validateAndProceed,
  };
}
