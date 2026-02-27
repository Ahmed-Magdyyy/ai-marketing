import { UserModel, IUserDocument } from "../auth/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode } from "../../shared/types";

async function getProfile(userId: string): Promise<IUserDocument> {
  const user = await UserModel.findById(userId).select("-passwordHash");

  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  return user;
}

interface UpdateProfileInput {
  name?: string;
  phone?: string;
  lang?: "ar" | "en";
}

async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<IUserDocument> {
  const { name, phone, lang } = input;

  const updateData: Partial<Pick<IUserDocument, "name" | "phone" | "lang">> =
    {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (lang !== undefined) updateData.lang = lang;

  const user = await UserModel.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true },
  ).select("-passwordHash");

  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  return user;
}

async function deleteProfile(userId: string): Promise<{ deleted: boolean }> {
  const user = await UserModel.findByIdAndDelete(userId);

  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  return { deleted: true };
}

export const clientService = {
  getProfile,
  updateProfile,
  deleteProfile,
};
